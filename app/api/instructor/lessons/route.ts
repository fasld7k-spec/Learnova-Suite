import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAddonRuntime } from '@/lib/addons';
import { saveLessonAttachment, saveLessonVideo } from '@/lib/course-upload';
import { verifyCsrf } from '@/lib/csrf';
import { toJson } from '@/lib/json-fields';
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

function requiredDate(value: FormDataEntryValue | null, label: string) {
  const date = optionalDate(value, label);
  if (!date) throw new Error(`${label} is required.`);
  return date;
}

function readQuizQuestions(form: FormData): QuizQuestion[] {
  const prompt = cleanString(form.get('questionPrompt'));
  const options = ['optionA', 'optionB', 'optionC', 'optionD'].map((key) => cleanString(form.get(key))).filter(Boolean);
  const answer = cleanString(form.get('answer'));
  if (!prompt && options.length === 0 && !answer) return [];
  return [{ q: prompt, type: 'mcq', options, answer }];
}

function requireQuizQuestions(questions: QuizQuestion[], lessonTitle: string) {
  if (!questions.length || questions.some((question) => !question.q || question.options.length < 2 || !question.answer)) {
    throw new Error(`Quiz lesson "${lessonTitle}" requires a question, at least two answer options, and the correct answer.`);
  }
}

function readActivityMeta({
  form,
  type,
  title,
  content,
  videoUrl,
  durationMinutes,
  isPreview
}: {
  form: FormData;
  type: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  durationMinutes: number;
  isPreview: boolean;
}): ActivityMeta {
  if (type === 'QUIZ') {
    const questions = readQuizQuestions(form);
    requireQuizQuestions(questions, title);
    return {
      kind: 'QUIZ',
      title: cleanString(form.get('quizTitle')) || `${title} quiz`,
      passingScore: clampedScore(form.get('passingScore')),
      questions
    };
  }

  if (type === 'ASSIGNMENT') {
    const description = cleanString(form.get('assignmentDescription')) || content || '';
    if (!description) throw new Error(`Assignment lesson "${title}" requires clear submission instructions.`);
    return {
      kind: 'ASSIGNMENT',
      title: cleanString(form.get('assignmentTitle')) || `${title} assignment`,
      description,
      dueAt: optionalDate(form.get('assignmentDueAt'), `Assignment "${title}" due date`)
    };
  }

  if (type === 'LIVE') {
    const liveUrl = validateStoredUrl(cleanString(form.get('liveUrl')) || videoUrl || '', {
      label: `Live lesson "${title}" meeting URL`,
      allowRelative: true
    });
    if (!liveUrl) throw new Error(`Live lesson "${title}" needs a meeting URL before it can be saved.`);
    return {
      kind: 'LIVE',
      title: cleanString(form.get('liveTitle')) || title,
      description: cleanString(form.get('liveDescription')) || content,
      startsAt: requiredDate(form.get('liveStartsAt'), `Live lesson "${title}" start time`),
      durationMinutes: Number(form.get('liveDurationMinutes') || durationMinutes || 60),
      provider: cleanString(form.get('liveProvider')).toUpperCase() || 'EXTERNAL',
      url: liveUrl,
      isPreview: form.get('liveIsPreview') === 'on' || isPreview
    };
  }

  return null;
}

function validationStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  return /(requires|required|needs|must|valid|invalid)/i.test(message) ? 422 : 500;
}

function routeFail(req: NextRequest, message: string, status = 422) {
  return formFail(req, message, status, '/instructor/courses');
}

async function ensureLinkedActivityRecord({
  courseId,
  instructorId,
  lesson,
  activity
}: {
  courseId: string;
  instructorId: string;
  lesson: { id: string; type: string; title: string; content: string | null; videoUrl: string | null; durationMinutes: number };
  activity: ActivityMeta;
}) {
  if (lesson.type === 'QUIZ') {
    if (!activity || activity.kind !== 'QUIZ') throw new Error(`Quiz lesson "${lesson.title}" requires complete quiz details.`);
    const existing = await prisma.quiz.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
    if (!existing) {
      await prisma.quiz.create({
        data: {
          lessonId: lesson.id,
          title: activity.title,
          passingScore: activity.passingScore,
          questions: toJson(activity.questions)
        }
      });
    } else {
      await prisma.quiz.update({
        where: { id: existing.id },
        data: { title: activity.title, passingScore: activity.passingScore, questions: toJson(activity.questions) }
      });
    }
  }

  if (lesson.type === 'ASSIGNMENT') {
    if (!activity || activity.kind !== 'ASSIGNMENT') throw new Error(`Assignment lesson "${lesson.title}" requires complete assignment details.`);
    const existing = await prisma.assignment.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
    if (!existing) {
      await prisma.assignment.create({
        data: {
          courseId,
          lessonId: lesson.id,
          title: activity.title,
          description: activity.description,
          dueAt: activity.dueAt
        }
      });
    } else {
      await prisma.assignment.update({
        where: { id: existing.id },
        data: {
          courseId,
          title: activity.title,
          description: activity.description,
          dueAt: activity.dueAt
        }
      });
    }
  }

  if (lesson.type === 'LIVE') {
    if (!activity || activity.kind !== 'LIVE') throw new Error(`Live lesson "${lesson.title}" requires complete live session details.`);
    const existing = await prisma.liveSession.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
    if (!existing) {
      await prisma.liveSession.create({
        data: {
          courseId,
          lessonId: lesson.id,
          instructorId,
          title: activity.title,
          description: activity.description,
          startsAt: activity.startsAt,
          durationMinutes: activity.durationMinutes || 60,
          provider: activity.provider,
          url: activity.url,
          isPreview: activity.isPreview
        }
      });
    } else {
      await prisma.liveSession.update({
        where: { id: existing.id },
        data: {
          courseId,
          instructorId,
          title: activity.title,
          description: activity.description,
          startsAt: activity.startsAt,
          durationMinutes: activity.durationMinutes || 60,
          provider: activity.provider,
          url: activity.url,
          isPreview: activity.isPreview
        }
      });
    }
  }
}

async function removeActivityRecordsForInactiveTypes(lessonId: string, activeType: string) {
  if (activeType !== 'LIVE') {
    await prisma.liveSession.updateMany({ where: { lessonId }, data: { lessonId: null } });
  }
  if (activeType !== 'QUIZ') {
    const quizzes = await prisma.quiz.findMany({ where: { lessonId }, select: { id: true } });
    const quizIds = quizzes.map((quiz) => quiz.id);
    if (quizIds.length) await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });
    await prisma.quiz.deleteMany({ where: { lessonId } });
  }
  if (activeType !== 'ASSIGNMENT') {
    await prisma.assignment.deleteMany({ where: { lessonId } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return routeFail(req, 'Invalid CSRF token.', 403);

    const courseId = String(f.get('courseId'));
    const action = String(f.get('action') || 'create');

    if (action === 'toggle-preview') {
      const lessonId = String(f.get('lessonId') || '');
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          module: { course: { id: courseId, instructorId: user.id } }
        },
        select: { id: true }
      });
      if (!lesson) return routeFail(req, 'Lesson not found', 404);

      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { isPreview: f.get('isPreview') === 'on' }
      });

      return NextResponse.redirect(new URL(`/instructor/courses/${courseId}`, req.url), 303);
    }

    if (action === 'delete') {
      const lessonId = String(f.get('lessonId') || '');
      const lesson = await prisma.lesson.findFirst({
        where: {
          id: lessonId,
          module: { course: { id: courseId, instructorId: user.id } }
        },
        select: { id: true }
      });
      if (!lesson) return routeFail(req, 'Lesson not found', 404);
      const quizzes = await prisma.quiz.findMany({ where: { lessonId: lesson.id }, select: { id: true } });
      const quizIds = quizzes.map((quiz) => quiz.id);
      if (quizIds.length) await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });
      await prisma.liveSession.updateMany({ where: { lessonId: lesson.id }, data: { lessonId: null } });
      await prisma.quiz.deleteMany({ where: { lessonId: lesson.id } });
      await prisma.assignment.deleteMany({ where: { lessonId: lesson.id } });
      await prisma.lessonProgress.deleteMany({ where: { lessonId: lesson.id } });
      await prisma.lessonBookmark.deleteMany({ where: { lessonId: lesson.id } });
      await prisma.lesson.delete({ where: { id: lesson.id } });
      return NextResponse.redirect(new URL(`/instructor/courses/${courseId}`, req.url), 303);
    }

    const moduleId = String(f.get('moduleId'));
    const courseModule = await prisma.module.findFirst({ where: { id: moduleId, course: { instructorId: user.id } } });
    if (!courseModule || courseModule.courseId !== courseId) return routeFail(req, 'Module not found', 404);

    const requestedType = String(f.get('type') || 'VIDEO').toUpperCase();
    const type = lessonTypes.has(requestedType) ? requestedType : 'VIDEO';
    if (type === 'LIVE' && !(await getAddonRuntime('live-class-booking')).active) return routeFail(req, 'Live lessons require the Live Class Booking add-on to be active.', 403);
    const uploadedVideo = await saveLessonVideo(f.get('videoFile') as File | null);
    const uploadedAttachment = await saveLessonAttachment(f.get('attachmentFile') as File | null);
    const videoUrl = uploadedVideo || validateStoredUrl(String(f.get('videoUrl') || '').trim(), { label: 'Lesson video URL', allowRelative: true }) || null;
    const attachmentUrl = uploadedAttachment || validateStoredUrl(String(f.get('attachmentUrl') || '').trim(), { label: 'Lesson attachment URL', allowRelative: true }) || null;
    const title = cleanString(f.get('title'));
    const content = cleanString(f.get('content')) || null;
    const durationMinutes = Number(f.get('durationMinutes') || 0);
    const sortOrder = Number(f.get('sortOrder') || 0);
    const isPreview = f.get('isPreview') === 'on';
    const activity = readActivityMeta({ form: f, type, title, content, videoUrl, durationMinutes, isPreview });

    if (action === 'update') {
      const lessonId = String(f.get('lessonId') || '');
      const lesson = await prisma.lesson.findFirst({
        where: { id: lessonId, module: { course: { id: courseId, instructorId: user.id } } },
        select: { id: true }
      });
      if (!lesson) return routeFail(req, 'Lesson not found', 404);
      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          moduleId,
          title,
          type: type as any,
          videoUrl,
          content,
          attachmentUrl,
          durationMinutes,
          sortOrder,
          isPreview
        }
      });
      await removeActivityRecordsForInactiveTypes(updated.id, updated.type);
      await ensureLinkedActivityRecord({ courseId, instructorId: user.id, lesson: updated, activity });
      return NextResponse.redirect(new URL(`/instructor/courses/${courseId}`, req.url), 303);
    }

    const created = await prisma.lesson.create({
      data: {
        moduleId,
        title,
        type: type as any,
        videoUrl,
        content,
        attachmentUrl,
        durationMinutes,
        sortOrder,
        isPreview
      }
    });
    await ensureLinkedActivityRecord({ courseId, instructorId: user.id, lesson: created, activity });

    return NextResponse.redirect(new URL(`/instructor/courses/${courseId}`, req.url), 303);
  } catch (e: any) {
    return routeFail(req, e.message, validationStatus(e));
  }
}
