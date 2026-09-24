import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { toList } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';

const validStatuses = new Set(['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED']);
const validLevels = new Set(['beginner', 'intermediate', 'advanced']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/courses', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function lines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(raw: string) {
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `course-${Date.now()}`;
}

async function uniqueSlug(baseSlug: string, ignoreCourseId?: string) {
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === ignoreCourseId) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function numberValue(form: FormData, key: string, fallback = 0) {
  const amount = Number(value(form, key));
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
}

function nullableMoney(form: FormData, key: string) {
  const raw = value(form, key);
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function statusValue(raw: string) {
  const status = raw.toUpperCase();
  return validStatuses.has(status) ? status : 'PENDING';
}

function levelValue(raw: string) {
  const level = raw.toLowerCase();
  return validLevels.has(level) ? level : 'beginner';
}

async function courseData(form: FormData, ignoreCourseId?: string) {
  const title = value(form, 'title');
  const shortDescription = value(form, 'shortDescription');
  const fullDescription = value(form, 'fullDescription') || shortDescription;
  if (title.length < 3) throw new Error('Course title must be at least 3 characters.');
  if (shortDescription.length < 10) throw new Error('Short description must be at least 10 characters.');

  const price = numberValue(form, 'price');
  const salePrice = nullableMoney(form, 'salePrice');
  const categoryId = value(form, 'categoryId');
  const instructorId = value(form, 'instructorId');
  if (!categoryId) throw new Error('Course category is required.');
  if (!instructorId) throw new Error('Course instructor is required.');
  const coverImage = validateStoredUrl(value(form, 'coverImage'), { label: 'Course cover image', allowRelative: true }) || null;
  const promoVideo = validateStoredUrl(value(form, 'promoVideo'), { label: 'Promo video URL', allowRelative: true }) || null;
  const slug = await uniqueSlug(slugify(value(form, 'slug') || title), ignoreCourseId);

  return {
    title,
    slug,
    shortDescription,
    fullDescription,
    coverImage,
    promoVideo,
    price,
    salePrice,
    categoryId,
    instructorId,
    level: levelValue(value(form, 'level')),
    language: value(form, 'language') || 'en',
    durationMinutes: Math.round(numberValue(form, 'durationMinutes')),
    isFree: form.get('isFree') === 'on' || price === 0,
    includesCertificate: form.get('includesCertificate') === 'on',
    requirements: toList(lines(value(form, 'requirements'))),
    outcomes: toList(lines(value(form, 'outcomes'))),
    targetAudience: toList(lines(value(form, 'targetAudience'))),
    status: statusValue(value(form, 'status')),
  };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(value(form, 'csrfToken')))) return fail('Invalid CSRF token.', 403);

    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Course id is required.', 422);
      const course = await prisma.course.findUnique({
        where: { id },
        include: {
          modules: { include: { lessons: { select: { id: true } } } },
          _count: { select: { enrollments: true } }
        }
      });
      if (!course) return fail('Course not found.', 404);
      if (course._count.enrollments > 0) return fail('Courses with enrollments cannot be deleted. Reject or unpublish the course to preserve student records.', 409);
      const linkedOrderItems = await prisma.orderItem.count({ where: { courseId: id } });
      if (linkedOrderItems > 0) return fail('Courses linked to order history cannot be deleted. Reject or unpublish the course to preserve invoices, refunds and revenue reports.', 409);

      const lessonIds = course.modules.flatMap((courseModule) => courseModule.lessons.map((lesson) => lesson.id));
      const quizzes = lessonIds.length ? await prisma.quiz.findMany({ where: { lessonId: { in: lessonIds } }, select: { id: true } }) : [];
      const quizIds = quizzes.map((quiz) => quiz.id);
      const assignments = await prisma.assignment.findMany({ where: { courseId: id }, select: { id: true } });
      const assignmentIds = assignments.map((assignment) => assignment.id);
      const milestones = await prisma.courseMilestone.findMany({ where: { courseId: id }, select: { id: true } });
      const milestoneIds = milestones.map((milestone) => milestone.id);
      const scormPackages = await prisma.scormPackage.findMany({ where: { courseId: id }, select: { id: true } });
      const scormPackageIds = scormPackages.map((item) => item.id);

      await prisma.$transaction([
        prisma.favorite.deleteMany({ where: { courseId: id } }),
        prisma.cartItem.deleteMany({ where: { courseId: id } }),
        prisma.review.deleteMany({ where: { courseId: id } }),
        prisma.question.deleteMany({ where: { courseId: id } }),
        prisma.liveSession.deleteMany({ where: { courseId: id } }),
        prisma.courseNote.deleteMany({ where: { courseId: id } }),
        prisma.courseReport.deleteMany({ where: { courseId: id } }),
        prisma.discussionTopic.deleteMany({ where: { courseId: id } }),
        prisma.dripSchedule.deleteMany({ where: { courseId: id } }),
        prisma.coursePrerequisite.deleteMany({ where: { OR: [{ courseId: id }, { prerequisiteCourseId: id }] } }),
        prisma.courseTranslation.deleteMany({ where: { courseId: id } }),
        prisma.courseResource.deleteMany({ where: { courseId: id } }),
        prisma.courseView.deleteMany({ where: { courseId: id } }),
        prisma.courseWaitlist.deleteMany({ where: { courseId: id } }),
        prisma.courseCohort.deleteMany({ where: { courseId: id } }),
        prisma.courseOutcomeSkill.deleteMany({ where: { courseId: id } }),
        prisma.courseLicense.deleteMany({ where: { courseId: id } }),
        prisma.courseFaq.deleteMany({ where: { courseId: id } }),
        prisma.courseAnnouncement.deleteMany({ where: { courseId: id } }),
        prisma.tenantCourse.deleteMany({ where: { courseId: id } }),
        ...(assignmentIds.length ? [prisma.assignmentSubmission.deleteMany({ where: { assignmentId: { in: assignmentIds } } })] : []),
        prisma.assignment.deleteMany({ where: { courseId: id } }),
        ...(milestoneIds.length ? [prisma.milestoneProgress.deleteMany({ where: { milestoneId: { in: milestoneIds } } })] : []),
        prisma.courseMilestone.deleteMany({ where: { courseId: id } }),
        ...(scormPackageIds.length ? [prisma.scormAttempt.deleteMany({ where: { packageId: { in: scormPackageIds } } })] : []),
        prisma.scormPackage.deleteMany({ where: { courseId: id } }),
        ...(quizIds.length ? [prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizIds } } })] : []),
        ...(lessonIds.length ? [prisma.lessonBookmark.deleteMany({ where: { lessonId: { in: lessonIds } } })] : []),
        ...(lessonIds.length ? [prisma.lessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } })] : []),
        ...(lessonIds.length ? [prisma.quiz.deleteMany({ where: { lessonId: { in: lessonIds } } })] : []),
        prisma.course.delete({ where: { id } }),
      ]);

      await invalidateCourseCatalogCache();
      await audit({ actorId: admin.id, action: 'course.admin_delete', entity: 'course', entityId: id, metadata: { title: course.title, slug: course.slug } });
      return redirect(req);
    }

    if (action === 'update') {
      if (!id) return fail('Course id is required.', 422);
      const data = await courseData(form, id);
      const course = await prisma.course.update({ where: { id }, data });
      await invalidateCourseCatalogCache();
      await audit({ actorId: admin.id, action: 'course.admin_update', entity: 'course', entityId: course.id, metadata: { title: course.title, slug: course.slug, status: course.status } });
      return redirect(req);
    }

    const data = await courseData(form);
    const course = await prisma.course.create({ data });
    await invalidateCourseCatalogCache();
    await audit({ actorId: admin.id, action: 'course.admin_create', entity: 'course', entityId: course.id, metadata: { title: course.title, slug: course.slug, status: course.status } });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Course update failed.', 500);
  }
}
