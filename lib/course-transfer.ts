import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { toList } from '@/lib/json-fields';
import { validateStoredUrl } from '@/lib/url-validation';
import { assertSafeServerUrl } from '@/lib/egress-url';

type ImportPayload = {
  title?: string;
  fileUrl?: string;
  notes?: string;
};

function slugify(value: unknown) {
  const slug = String(value || 'course')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `course-${Date.now()}`;
}

async function uniqueCourseSlug(base: string) {
  let slug = base;
  let suffix = 2;
  while (await prisma.course.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

async function defaultCategoryId() {
  const existing = await prisma.category.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (existing) return existing.id;

  const category = await prisma.category.create({
    data: {
      nameEn: 'Imported Courses',
      nameAr: 'الدورات المستوردة',
      slug: `imported-courses-${Date.now()}`,
    },
  });
  return category.id;
}

async function readImportText(fileUrl: string) {
  const trimmed = fileUrl.trim();
  if (!trimmed) throw new Error('Import file URL is required.');

  if (trimmed.startsWith('data:')) {
    const [, body = ''] = trimmed.split(',', 2);
    return decodeURIComponent(body);
  }

  if (trimmed.startsWith('/')) {
    const publicRoot = path.resolve(process.cwd(), 'public');
    const absolute = path.resolve(publicRoot, trimmed.replace(/^\/+/, ''));
    if (absolute !== publicRoot && !absolute.startsWith(`${publicRoot}${path.sep}`)) {
      throw new Error('Import local path must stay inside the public directory.');
    }
    return readFile(absolute, 'utf8');
  }

  const url = await assertSafeServerUrl(trimmed, { label: 'Import URL', requireHttps: process.env.NODE_ENV === 'production' });
  const response = await fetch(url, { redirect: 'manual' });
  if (!response.ok) throw new Error(`Import file could not be fetched (${response.status}).`);
  return response.text();
}

function csvRows(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

async function createCourseFromRecord(record: Record<string, any>, adminId: string) {
  const title = String(record.title || record.name || 'Imported Course').trim();
  if (title.length < 3) throw new Error('Imported course title must be at least 3 characters.');
  const categoryId = String(record.categoryId || '').trim() || await defaultCategoryId();
  const slug = await uniqueCourseSlug(slugify(record.slug || title));
  const modules = Array.isArray(record.modules) ? record.modules : [];
  const optionalUrl = (value: unknown, label: string) => {
    const raw = String(value || '').trim();
    return raw ? validateStoredUrl(raw, { label, allowRelative: true }) : null;
  };

  return prisma.course.create({
    data: {
      title,
      slug,
      shortDescription: String(record.shortDescription || record.summary || 'Imported course draft.').trim(),
      fullDescription: String(record.fullDescription || record.description || 'Imported course content. Review before publishing.').trim(),
      coverImage: optionalUrl(record.coverImage, 'Imported course cover image'),
      promoVideo: optionalUrl(record.promoVideo, 'Imported course promo video'),
      price: Number(record.price || 0),
      salePrice: record.salePrice ? Number(record.salePrice) : null,
      language: String(record.language || 'en'),
      level: String(record.level || 'beginner'),
      durationMinutes: Number(record.durationMinutes || 0),
      requirements: Array.isArray(record.requirements) ? toList(record.requirements) : toList(String(record.requirements || '').split('|').filter(Boolean)),
      outcomes: Array.isArray(record.outcomes) ? toList(record.outcomes) : toList(String(record.outcomes || '').split('|').filter(Boolean)),
      targetAudience: Array.isArray(record.targetAudience) ? toList(record.targetAudience) : toList(String(record.targetAudience || '').split('|').filter(Boolean)),
      status: ['PENDING', 'PUBLISHED', 'DRAFT'].includes(String(record.status || '').toUpperCase()) ? String(record.status).toUpperCase() : 'PENDING',
      isFree: Number(record.price || 0) <= 0,
      includesCertificate: record.includesCertificate === false ? false : true,
      instructorId: String(record.instructorId || '').trim() || adminId,
      categoryId,
      modules: modules.length
        ? {
            create: modules.map((module: any, moduleIndex: number) => ({
              title: String(module.title || `Module ${moduleIndex + 1}`),
              sortOrder: Number(module.sortOrder || moduleIndex),
              lessons: Array.isArray(module.lessons) && module.lessons.length
                ? {
                    create: module.lessons.map((lesson: any, lessonIndex: number) => ({
                      title: String(lesson.title || `Lesson ${lessonIndex + 1}`),
                      type: String(lesson.type || 'VIDEO').toUpperCase(),
                      videoUrl: optionalUrl(lesson.videoUrl, 'Imported lesson video URL'),
                      content: lesson.content || null,
                      attachmentUrl: optionalUrl(lesson.attachmentUrl, 'Imported lesson attachment URL'),
                      durationMinutes: Number(lesson.durationMinutes || 0),
                      isPreview: Boolean(lesson.isPreview),
                      sortOrder: Number(lesson.sortOrder || lessonIndex),
                    })),
                  }
                : undefined,
            })),
          }
        : undefined,
    },
  });
}

export async function processCourseImportJob(jobId: string, adminId: string) {
  const job = await prisma.courseImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Import job not found.');

  try {
    await prisma.courseImportJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });
    const payload = JSON.parse(job.payload || '{}') as ImportPayload;
    const text = await readImportText(payload.fileUrl || '');
    const imported = [];

    if (job.source === 'csv') {
      const rows = csvRows(text);
      if (!rows.length) throw new Error('CSV import file has no rows.');
      for (const row of rows) imported.push(await createCourseFromRecord(row, adminId));
    } else {
      const json = JSON.parse(text);
      const records = Array.isArray(json) ? json : Array.isArray(json.courses) ? json.courses : [json.course || json];
      for (const record of records) imported.push(await createCourseFromRecord(record, adminId));
    }

    await prisma.courseImportJob.update({
      where: { id: job.id },
      data: { status: 'DONE', payload: JSON.stringify({ ...payload, importedCourseIds: imported.map((course) => course.id), importedCount: imported.length }) },
    });
    if (imported.length > 0) await invalidateCourseCatalogCache();
    return { importedCount: imported.length };
  } catch (error: any) {
    await prisma.courseImportJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', payload: JSON.stringify({ ...(JSON.parse(job.payload || '{}') as ImportPayload), error: error.message }) },
    }).catch(() => null);
    throw error;
  }
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function writeExportFile(fileName: string, content: string) {
  const dir = path.join(process.cwd(), 'public', 'exports');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), content, 'utf8');
  return `/exports/${fileName}`;
}

async function buildCourseBackupPayload(course: any) {
  const lessonIds = course.modules.flatMap((module: any) => module.lessons.map((lesson: any) => lesson.id));
  const [
    quizzes,
    assignments,
    liveSessions,
    resources,
    faqs,
    announcements,
    dripSchedules,
    translations,
    prerequisites,
  ] = await Promise.all([
    lessonIds.length ? prisma.quiz.findMany({ where: { lessonId: { in: lessonIds } } }) : [],
    prisma.assignment.findMany({ where: { courseId: course.id } }),
    prisma.liveSession.findMany({ where: { courseId: course.id } }),
    prisma.courseResource.findMany({ where: { courseId: course.id } }),
    prisma.courseFaq.findMany({ where: { courseId: course.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.courseAnnouncement.findMany({ where: { courseId: course.id }, orderBy: { createdAt: 'desc' } }),
    prisma.dripSchedule.findMany({ where: { courseId: course.id } }),
    prisma.courseTranslation.findMany({ where: { courseId: course.id } }),
    prisma.coursePrerequisite.findMany({ where: { courseId: course.id } }),
  ]);
  const assetReferences = [
    course.coverImage,
    course.promoVideo,
    ...course.modules.flatMap((module: any) => module.lessons.flatMap((lesson: any) => [lesson.videoUrl, lesson.attachmentUrl])),
    ...resources.map((resource: any) => resource.url),
  ].filter(Boolean);

  return {
    kind: 'learnova.course.backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    restoreNotes: 'JSON backup with course structure, lesson records, activity records, resources, translations, announcements, drip schedules, prerequisites, and referenced media URLs. Referenced media files remain at their stored/CDN URLs.',
    manifest: {
      courseId: course.id,
      slug: course.slug,
      title: course.title,
      moduleCount: course.modules.length,
      lessonCount: lessonIds.length,
      assetReferences,
    },
    course,
    related: {
      quizzes,
      assignments,
      liveSessions,
      resources,
      faqs,
      announcements,
      dripSchedules,
      translations,
      prerequisites,
    },
  };
}

export async function processCourseExportJob(jobId: string) {
  const job = await prisma.courseExportJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Export job not found.');

  try {
    await prisma.courseExportJob.update({ where: { id: job.id }, data: { status: 'PROCESSING' } });
    const course = await prisma.course.findUnique({
      where: { id: job.courseId },
      include: { modules: { include: { lessons: true }, orderBy: { sortOrder: 'asc' } }, category: true, instructor: { select: { id: true, name: true, email: true } } },
    });
    if (!course) throw new Error('Course not found.');

    const stamp = Date.now();
    const safeSlug = slugify(course.slug || course.title);
    let fileUrl = '';

    if (job.format === 'csv') {
      const headers = ['title', 'slug', 'shortDescription', 'fullDescription', 'price', 'language', 'level', 'status'];
      const row = headers.map((key) => csvEscape((course as any)[key])).join(',');
      fileUrl = await writeExportFile(`${safeSlug}-${stamp}.csv`, `${headers.join(',')}\n${row}\n`);
    } else if (job.format === 'backup') {
      const payload = await buildCourseBackupPayload(course);
      fileUrl = await writeExportFile(`${safeSlug}-${stamp}.backup.json`, JSON.stringify(payload, null, 2));
    } else {
      const payload = {
        exportedAt: new Date().toISOString(),
        format: job.format,
        course,
      };
      fileUrl = await writeExportFile(`${safeSlug}-${stamp}.json`, JSON.stringify(payload, null, 2));
    }

    await prisma.courseExportJob.update({ where: { id: job.id }, data: { status: 'DONE', fileUrl } });
    return { fileUrl };
  } catch (error: any) {
    await prisma.courseExportJob.update({ where: { id: job.id }, data: { status: 'FAILED' } }).catch(() => null);
    throw error;
  }
}
