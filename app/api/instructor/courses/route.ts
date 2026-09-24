import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAddonRuntime } from '@/lib/addons';
import { toJson, toList } from '@/lib/json-fields';
import { saveCourseCover, saveLessonAttachment, saveLessonVideo } from '@/lib/course-upload';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { validateStoredUrl } from '@/lib/url-validation';
import { formFail } from '@/lib/form-response';

const lessonTypes = new Set(['VIDEO', 'TEXT', 'PDF', 'FILE', 'QUIZ', 'ASSIGNMENT', 'LIVE', 'EXTERNAL']);

type QuizQuestion = {
  q: string;
  type: 'mcq';
  options: string[];
  answer: string;
};

type ActivityMeta =
  | { kind: 'QUIZ'; title: string; passingScore: number; questions: QuizQuestion[] }
  | { kind: 'ASSIGNMENT'; title: string; description: string; dueAt: Date | null }
  | { kind: 'LIVE'; title: string; description: string | null; startsAt: Date; durationMinutes: number; provider: string; url: string; isPreview: boolean }
  | null;

type DraftLesson = {
  title: string;
  type: string;
  videoUrl: string | null;
  attachmentUrl: string | null;
  content: string | null;
  durationMinutes: number;
  isPreview: boolean;
  sortOrder: number;
  activity: ActivityMeta;
};

type CreatedLessonWithActivity = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  durationMinutes: number;
  activity?: ActivityMeta;
};

function lines(value: FormDataEntryValue | null) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanSlug(value: FormDataEntryValue | null, fallback: FormDataEntryValue | null) {
  const raw = String(value || fallback || 'course')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return raw || `course-${Date.now()}`;
}

async function uniqueCourseSlug(baseSlug: string) {
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.course.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function indexedValue(f: FormData, key: string, moduleIndex: number, lessonIndex: number) {
  return f.get(`${key}-${moduleIndex}-${lessonIndex}`);
}

function cleanString(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function clampedScore(value: FormDataEntryValue | null) {
  const score = Number(value || 70);
  return Math.min(100, Math.max(1, Number.isFinite(score) ? score : 70));
}

function optionalDate(value: FormDataEntryValue | null, label: string) {
  const raw = cleanString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date;
}

function requiredFutureDate(value: FormDataEntryValue | null, label: string) {
  const date = optionalDate(value, label);
  if (!date) throw new Error(`${label} is required.`);
  return date;
}

function indexedQuizQuestions(f: FormData, moduleIndex: number, lessonIndex: number): QuizQuestion[] {
  const prompt = cleanString(indexedValue(f, 'quizQuestionPrompt', moduleIndex, lessonIndex));
  const options = ['quizOptionA', 'quizOptionB', 'quizOptionC', 'quizOptionD']
    .map((key) => cleanString(indexedValue(f, key, moduleIndex, lessonIndex)))
    .filter(Boolean);
  const answer = cleanString(indexedValue(f, 'quizAnswer', moduleIndex, lessonIndex));

  if (!prompt && options.length === 0 && !answer) return [];

  return [{ q: prompt, type: 'mcq', options, answer }];
}

function requireQuizQuestions(questions: QuizQuestion[], lessonTitle: string) {
  if (!questions.length || questions.some((question) => !question.q || question.options.length < 2 || !question.answer)) {
    throw new Error(`Quiz lesson "${lessonTitle}" requires a question, at least two answer options, and the correct answer.`);
  }
}

function indexedActivityMeta({
  f,
  moduleIndex,
  lessonIndex,
  type,
  lessonTitle,
  content,
  videoUrl,
  durationMinutes,
  lessonIsPreview
}: {
  f: FormData;
  moduleIndex: number;
  lessonIndex: number;
  type: string;
  lessonTitle: string;
  content: string | null;
  videoUrl: string | null;
  durationMinutes: number;
  lessonIsPreview: boolean;
}): ActivityMeta {
  if (type === 'QUIZ') {
    const questions = indexedQuizQuestions(f, moduleIndex, lessonIndex);
    requireQuizQuestions(questions, lessonTitle);
    return {
      kind: 'QUIZ',
      title: cleanString(indexedValue(f, 'quizTitle', moduleIndex, lessonIndex)) || `${lessonTitle} quiz`,
      passingScore: clampedScore(indexedValue(f, 'quizPassingScore', moduleIndex, lessonIndex)),
      questions
    };
  }

  if (type === 'ASSIGNMENT') {
    const description = cleanString(indexedValue(f, 'assignmentDescription', moduleIndex, lessonIndex)) || content || '';
    if (!description) throw new Error(`Assignment lesson "${lessonTitle}" requires clear submission instructions.`);
    return {
      kind: 'ASSIGNMENT',
      title: cleanString(indexedValue(f, 'assignmentTitle', moduleIndex, lessonIndex)) || `${lessonTitle} assignment`,
      description,
      dueAt: optionalDate(indexedValue(f, 'assignmentDueAt', moduleIndex, lessonIndex), `Assignment "${lessonTitle}" due date`)
    };
  }

  if (type === 'LIVE') {
    const liveUrl = validateStoredUrl(cleanString(indexedValue(f, 'liveUrl', moduleIndex, lessonIndex)) || videoUrl || '', {
      label: `Live lesson "${lessonTitle}" meeting URL`,
      allowRelative: true
    });
    if (!liveUrl) throw new Error(`Live lesson "${lessonTitle}" needs a meeting URL before it can be saved.`);
    return {
      kind: 'LIVE',
      title: cleanString(indexedValue(f, 'liveTitle', moduleIndex, lessonIndex)) || lessonTitle,
      description: cleanString(indexedValue(f, 'liveDescription', moduleIndex, lessonIndex)) || content,
      startsAt: requiredFutureDate(indexedValue(f, 'liveStartsAt', moduleIndex, lessonIndex), `Live lesson "${lessonTitle}" start time`),
      durationMinutes: Number(indexedValue(f, 'liveDurationMinutes', moduleIndex, lessonIndex) || durationMinutes || 60),
      provider: cleanString(indexedValue(f, 'liveProvider', moduleIndex, lessonIndex)).toUpperCase() || 'EXTERNAL',
      url: liveUrl,
      isPreview: indexedValue(f, 'liveIsPreview', moduleIndex, lessonIndex) === 'on' || lessonIsPreview
    };
  }

  return null;
}

async function initialCurriculum(f: FormData) {
  const modulesCount = Math.min(Number(f.get('modulesCount') || 0), 20);
  const modules: { title: string; sortOrder: number; lessons: DraftLesson[] }[] = [];

  for (let moduleIndex = 0; moduleIndex < modulesCount; moduleIndex += 1) {
    const title = String(f.get(`moduleTitle-${moduleIndex}`) || '').trim();
    if (!title) continue;

    const lessonsCount = Math.min(Number(f.get(`lessonsCount-${moduleIndex}`) || 0), 80);
    const lessons = [];

    for (let lessonIndex = 0; lessonIndex < lessonsCount; lessonIndex += 1) {
      const lessonTitle = String(f.get(`lessonTitle-${moduleIndex}-${lessonIndex}`) || '').trim();
      if (!lessonTitle) continue;

      const requestedType = String(f.get(`lessonType-${moduleIndex}-${lessonIndex}`) || 'VIDEO').toUpperCase();
      const type = lessonTypes.has(requestedType) ? requestedType : 'VIDEO';
      const videoFile = f.get(`lessonVideoFile-${moduleIndex}-${lessonIndex}`) as File | null;
      const attachmentFile = f.get(`lessonAttachmentFile-${moduleIndex}-${lessonIndex}`) as File | null;
      const uploadedVideo = await saveLessonVideo(videoFile);
      const uploadedAttachment = await saveLessonAttachment(attachmentFile);
      const pastedVideo = validateStoredUrl(String(f.get(`lessonVideoUrl-${moduleIndex}-${lessonIndex}`) || '').trim(), {
        label: 'Lesson video URL',
        allowRelative: true
      });
      const pastedAttachment = validateStoredUrl(String(f.get(`lessonAttachmentUrl-${moduleIndex}-${lessonIndex}`) || '').trim(), {
        label: 'Lesson attachment URL',
        allowRelative: true
      });

      const content = cleanString(f.get(`lessonContent-${moduleIndex}-${lessonIndex}`)) || null;
      const durationMinutes = Number(f.get(`lessonDurationMinutes-${moduleIndex}-${lessonIndex}`) || 0);
      const isPreview = f.get(`lessonIsPreview-${moduleIndex}-${lessonIndex}`) === 'on';
      const videoUrl = uploadedVideo || pastedVideo || null;

      lessons.push({
        title: lessonTitle,
        type,
        videoUrl,
        attachmentUrl: uploadedAttachment || pastedAttachment || null,
        content,
        durationMinutes,
        isPreview,
        sortOrder: Number(f.get(`lessonSortOrder-${moduleIndex}-${lessonIndex}`) || lessonIndex),
        activity: indexedActivityMeta({ f, moduleIndex, lessonIndex, type, lessonTitle, content, videoUrl, durationMinutes, lessonIsPreview: isPreview })
      });
    }

    modules.push({
      title,
      sortOrder: Number(f.get(`moduleSortOrder-${moduleIndex}`) || moduleIndex),
      lessons
    });
  }

  return modules;
}

async function createLinkedActivityRecords(courseId: string, instructorId: string, lessons: CreatedLessonWithActivity[]) {
  for (const lesson of lessons) {
    if (lesson.type === 'QUIZ') {
      if (!lesson.activity || lesson.activity.kind !== 'QUIZ') throw new Error(`Quiz lesson "${lesson.title}" requires complete quiz details.`);
      const existing = await prisma.quiz.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
      if (!existing) {
        await prisma.quiz.create({
          data: {
            lessonId: lesson.id,
            title: lesson.activity.title,
            passingScore: lesson.activity.passingScore,
            questions: toJson(lesson.activity.questions)
          }
        });
      }
    }

    if (lesson.type === 'ASSIGNMENT') {
      if (!lesson.activity || lesson.activity.kind !== 'ASSIGNMENT') throw new Error(`Assignment lesson "${lesson.title}" requires complete assignment details.`);
      const existing = await prisma.assignment.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
      if (!existing) {
        await prisma.assignment.create({
          data: {
            courseId,
            lessonId: lesson.id,
            title: lesson.activity.title,
            description: lesson.activity.description,
            dueAt: lesson.activity.dueAt
          }
        });
      }
    }

    if (lesson.type === 'LIVE') {
      if (!lesson.activity || lesson.activity.kind !== 'LIVE') throw new Error(`Live lesson "${lesson.title}" requires complete live session details.`);
      const existing = await prisma.liveSession.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
      if (!existing) {
        await prisma.liveSession.create({
          data: {
            courseId,
            lessonId: lesson.id,
            instructorId,
            title: lesson.activity.title,
            description: lesson.activity.description,
            startsAt: lesson.activity.startsAt,
            durationMinutes: lesson.activity.durationMinutes || 60,
            provider: lesson.activity.provider,
            url: lesson.activity.url,
            isPreview: lesson.activity.isPreview
          }
        });
      }
    }
  }
}

function statusFromForm(value: FormDataEntryValue | null) {
  const status = String(value || 'DRAFT').trim().toUpperCase();
  return status === 'PENDING' ? 'PENDING' : 'DRAFT';
}

function optionalStoredUrl(value: FormDataEntryValue | null, label: string) {
  const raw = String(value || '').trim();
  return raw ? validateStoredUrl(raw, { label, allowRelative: true }) : '';
}

function lessonCreateData(lesson: DraftLesson) {
  const { activity: _activity, ...data } = lesson;
  return data;
}

function validationStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  return /(requires|required|needs|must|valid|invalid)/i.test(message) ? 422 : 500;
}

function hasGeneratedDraftLessonContent(content: string | null) {
  return /replace this generated draft lesson/i.test(content || '');
}

function routeFail(req: NextRequest, message: string, status = 422) {
  return formFail(req, message, status, '/instructor/courses/new');
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();

    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return routeFail(req, 'Invalid CSRF token.', 403);

    const action = String(f.get('action') || 'create').trim();
    const courseId = String(f.get('courseId') || '').trim();

    if (action === 'submit-review') {
      const course = await prisma.course.findFirst({
        where: { id: courseId, instructorId: user.id },
        include: { modules: { include: { lessons: { select: { id: true, title: true, content: true } } } } }
      });
      if (!course) return routeFail(req, 'Course not found.', 404);
      const lessonCount = course.modules.reduce((sum, courseModule) => sum + courseModule.lessons.length, 0);
      if (!course.title.trim() || !course.shortDescription.trim() || !course.fullDescription.trim()) return routeFail(req, 'Complete course title and descriptions before submitting.', 422);
      if (!course.coverImage) return routeFail(req, 'Upload or paste a course cover before submitting for review.', 422);
      if (course.modules.length === 0 || lessonCount === 0) return routeFail(req, 'Add at least one module and lesson before submitting for review.', 422);
      const draftLesson = course.modules.flatMap((courseModule) => courseModule.lessons).find((lesson) => hasGeneratedDraftLessonContent(lesson.content));
      if (draftLesson) return routeFail(req, `Replace the generated draft content in lesson "${draftLesson.title}" before submitting for review.`, 422);
      await prisma.course.update({ where: { id: course.id }, data: { status: 'PENDING' } });
      await invalidateCourseCatalogCache();
      return NextResponse.redirect(new URL(`/instructor/courses/${course.id}?submitted=1`, req.url), 303);
    }

    if (action === 'move-draft') {
      const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: user.id } });
      if (!course) return routeFail(req, 'Course not found.', 404);
      if (course.status === 'PUBLISHED') return routeFail(req, 'Published courses must be changed by an admin review action.', 422);
      await prisma.course.update({ where: { id: course.id }, data: { status: 'DRAFT' } });
      await invalidateCourseCatalogCache();
      return NextResponse.redirect(new URL(`/instructor/courses/${course.id}?draft=1`, req.url), 303);
    }

    if (action === 'update') {
      const course = await prisma.course.findFirst({ where: { id: courseId, instructorId: user.id } });
      if (!course) return routeFail(req, 'Course not found.', 404);
      const uploadedCover = await saveCourseCover(f.get('coverImageFile') as File | null);
      const pastedCover = optionalStoredUrl(f.get('coverImage'), 'Course cover image');
      const promoVideo = optionalStoredUrl(f.get('promoVideo'), 'Promo video URL');
      await prisma.course.update({
        where: { id: course.id },
        data: {
          title: String(f.get('title') || course.title).trim() || course.title,
          shortDescription: String(f.get('shortDescription') || course.shortDescription).trim() || course.shortDescription,
          fullDescription: String(f.get('fullDescription') || course.fullDescription).trim() || course.fullDescription,
          coverImage: uploadedCover || pastedCover || course.coverImage,
          promoVideo: promoVideo || null,
          price: Number(f.get('price') || course.price || 0),
          salePrice: f.get('salePrice') ? Number(f.get('salePrice')) : null,
          categoryId: String(f.get('categoryId') || course.categoryId),
          level: String(f.get('level') || course.level || 'beginner'),
          language: String(f.get('language') || course.language || 'en'),
          durationMinutes: Number(f.get('durationMinutes') || course.durationMinutes || 0),
          isFree: Number(f.get('price') || course.price || 0) === 0,
          includesCertificate: f.get('includesCertificate') === 'on',
          requirements: toList(lines(f.get('requirements'))),
          outcomes: toList(lines(f.get('outcomes'))),
          targetAudience: toList(lines(f.get('targetAudience'))),
        }
      });
      await invalidateCourseCatalogCache();
      return NextResponse.redirect(new URL(`/instructor/courses/${course.id}?saved=1`, req.url), 303);
    }

    const uploadedCover = await saveCourseCover(f.get('coverImageFile') as File | null);
    const pastedCover = optionalStoredUrl(f.get('coverImage'), 'Course cover image');
    const promoVideo = optionalStoredUrl(f.get('promoVideo'), 'Promo video URL');
    const slug = await uniqueCourseSlug(cleanSlug(f.get('slug'), f.get('title')));
    const modules = await initialCurriculum(f);
    const containsLiveLessons = modules.some((courseModule) => courseModule.lessons.some((lesson) => lesson.type === 'LIVE'));
    if (containsLiveLessons && !(await getAddonRuntime('live-class-booking')).active) return routeFail(req, 'Live lessons require the Live Class Booking add-on to be active.', 403);
    const initialStatus = statusFromForm(f.get('status'));
    if (initialStatus === 'PENDING' && (!String(f.get('title') || '').trim() || !String(f.get('shortDescription') || '').trim() || !String(f.get('fullDescription') || '').trim())) {
      return routeFail(req, 'Complete course title and descriptions before submitting.', 422);
    }
    if (initialStatus === 'PENDING' && !(uploadedCover || pastedCover)) return routeFail(req, 'Upload or paste a course cover before submitting for review.', 422);
    if (initialStatus === 'PENDING' && (modules.length === 0 || modules.every((courseModule) => courseModule.lessons.length === 0))) {
      return routeFail(req, 'Add at least one module and lesson before submitting for review.', 422);
    }

    const course = await prisma.course.create({
      data: {
        title: String(f.get('title')),
        slug,
        shortDescription: String(f.get('shortDescription')),
        fullDescription: String(f.get('fullDescription')),
        coverImage: uploadedCover || pastedCover || null,
        promoVideo: promoVideo || null,
        price: Number(f.get('price') || 0),
        salePrice: f.get('salePrice') ? Number(f.get('salePrice')) : null,
        categoryId: String(f.get('categoryId')),
        level: String(f.get('level') || 'beginner'),
        language: String(f.get('language') || 'en'),
        durationMinutes: Number(f.get('durationMinutes') || 0),
        isFree: Number(f.get('price') || 0) === 0,
        includesCertificate: f.get('includesCertificate') === 'on',
        requirements: toList(lines(f.get('requirements'))),
        outcomes: toList(lines(f.get('outcomes'))),
        targetAudience: toList(lines(f.get('targetAudience'))),
        instructorId: user.id,
        status: initialStatus,
        modules: modules.length
          ? {
              create: modules.map((courseModule) => ({
                title: courseModule.title,
                sortOrder: courseModule.sortOrder,
                lessons: courseModule.lessons.length ? { create: courseModule.lessons.map(lessonCreateData) } : undefined
              }))
            }
          : undefined
      },
      include: { modules: { include: { lessons: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } } }
    });
    const createdLessons = course.modules.flatMap((courseModule, moduleIndex) =>
      courseModule.lessons.map((lesson, lessonIndex) => ({
        ...lesson,
        activity: modules[moduleIndex]?.lessons[lessonIndex]?.activity
      }))
    );
    await createLinkedActivityRecords(
      course.id,
      user.id,
      createdLessons
    );
    await invalidateCourseCatalogCache();

    return NextResponse.redirect(new URL(`/instructor/courses/${course.id}`, req.url), 303);
  } catch (e: any) {
    return routeFail(req, e.message, validationStatus(e));
  }
}
