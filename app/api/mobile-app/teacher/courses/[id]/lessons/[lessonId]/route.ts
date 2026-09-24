import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { saveLessonAttachment, saveLessonVideo } from "@/lib/course-upload";
import { fromJsonArray, toJson } from "@/lib/json-fields";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import {
  mobileRequestAppUrl,
  mobileTeacherLessonMedia,
} from "@/lib/mobile-media-urls";
import { prisma } from "@/lib/prisma";
import { validateStoredUrl } from "@/lib/url-validation";

const lessonTypes = new Set([
  "VIDEO",
  "TEXT",
  "PDF",
  "FILE",
  "QUIZ",
  "ASSIGNMENT",
  "LIVE",
  "EXTERNAL",
]);

type QuizQuestion = {
  q: string;
  type: "mcq";
  options: string[];
  answer: string;
};

type LessonActivity =
  | {
      kind: "QUIZ";
      title: string;
      passingScore: number;
      questions: QuizQuestion[];
    }
  | {
      kind: "ASSIGNMENT";
      title: string;
      description: string;
      dueAt: Date | null;
    }
  | null;

function optionalUrlUpdate(
  body: Record<string, unknown>,
  keys: string[],
  label: string,
):
  | { ok: true; present: false }
  | { ok: true; present: true; value: string | null }
  | { ok: false; message: string } {
  const key = keys.find((item) =>
    Object.prototype.hasOwnProperty.call(body, item),
  );
  if (!key) return { ok: true, present: false };
  const value = body[key];
  if (typeof value !== "string")
    return { ok: true, present: true, value: null };
  const raw = value.trim();
  if (!raw) return { ok: true, present: true, value: null };
  try {
    return {
      ok: true,
      present: true,
      value: validateStoredUrl(raw, { label, allowRelative: true }) || null,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : `${label} is invalid.`,
    };
  }
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function clampedScore(value: unknown) {
  const score = Number(value || 70);
  return Math.min(100, Math.max(1, Number.isFinite(score) ? score : 70));
}

function optionalDate(value: unknown, label: string) {
  const raw = cleanString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()))
    throw new Error(`${label} must be a valid date.`);
  return date;
}

function normalizeLessonType(value: unknown, fallback: string) {
  if (value === undefined) return fallback;
  const type = cleanString(value || fallback).toUpperCase();
  return lessonTypes.has(type) ? type : "";
}

function parseFormTextValue(key: string, value: string): unknown {
  if (key !== "quizQuestions") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return file instanceof File ? file : null;
}

async function readLessonPayload(request: NextRequest): Promise<{
  body: Record<string, unknown>;
  videoFile: File | null;
  attachmentFile: File | null;
}> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return {
      body: (await request.json().catch(() => ({}))) as Record<string, unknown>,
      videoFile: null,
      attachmentFile: null,
    };
  }

  const formData = await request.formData();
  const body: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") body[key] = parseFormTextValue(key, value);
  }
  return {
    body,
    videoFile: formFile(formData, "videoFile"),
    attachmentFile: formFile(formData, "attachmentFile"),
  };
}

function parseQuizQuestions(body: Record<string, unknown>): QuizQuestion[] {
  const rawQuestions = Array.isArray(body.quizQuestions)
    ? body.quizQuestions
    : [];
  const questions = rawQuestions
    .map((item): QuizQuestion | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const prompt = cleanString(record.q ?? record.prompt);
      const options = Array.isArray(record.options)
        ? record.options.map(cleanString).filter(Boolean)
        : [];
      const answer = cleanString(record.answer);
      if (!prompt && options.length === 0 && !answer) return null;
      return { q: prompt, type: "mcq", options, answer };
    })
    .filter((item): item is QuizQuestion => Boolean(item));
  if (questions.length) return questions;

  const prompt = cleanString(body.quizQuestionPrompt);
  const options = [
    body.quizOptionA,
    body.quizOptionB,
    body.quizOptionC,
    body.quizOptionD,
  ]
    .map(cleanString)
    .filter(Boolean);
  const answer = cleanString(body.quizAnswer);
  if (!prompt && options.length === 0 && !answer) return [];
  return [{ q: prompt, type: "mcq", options, answer }];
}

function requireQuizQuestions(questions: QuizQuestion[], lessonTitle: string) {
  if (
    !questions.length ||
    questions.some(
      (question) =>
        !question.q || question.options.length < 2 || !question.answer,
    )
  ) {
    throw new Error(
      `Quiz lesson "${lessonTitle}" requires a question, at least two answer options, and the correct answer.`,
    );
  }
}

function parseActivity(
  body: Record<string, unknown>,
  type: string,
  title: string,
  content: string | null,
): LessonActivity {
  if (type === "QUIZ") {
    const questions = parseQuizQuestions(body);
    requireQuizQuestions(questions, title);
    return {
      kind: "QUIZ",
      title: cleanString(body.quizTitle) || `${title} quiz`,
      passingScore: clampedScore(body.quizPassingScore ?? body.passingScore),
      questions,
    };
  }

  if (type === "ASSIGNMENT") {
    const description =
      cleanString(body.assignmentDescription) || content || "";
    if (!description)
      throw new Error(
        `Assignment lesson "${title}" requires clear submission instructions.`,
      );
    return {
      kind: "ASSIGNMENT",
      title: cleanString(body.assignmentTitle) || `${title} assignment`,
      description,
      dueAt: optionalDate(
        body.assignmentDueAt,
        `Assignment "${title}" due date`,
      ),
    };
  }

  return null;
}

async function ensureLinkedActivityRecord({
  courseId,
  lesson,
  activity,
}: {
  courseId: string;
  lesson: { id: string; type: string; title: string };
  activity: LessonActivity;
}) {
  if (lesson.type === "QUIZ") {
    if (!activity || activity.kind !== "QUIZ")
      throw new Error(
        `Quiz lesson "${lesson.title}" requires complete quiz details.`,
      );
    const existing = await prisma.quiz.findFirst({
      where: { lessonId: lesson.id },
      select: { id: true },
    });
    const data = {
      title: activity.title,
      passingScore: activity.passingScore,
      questions: toJson(activity.questions),
    };
    if (existing) {
      await prisma.quiz.update({ where: { id: existing.id }, data });
    } else {
      await prisma.quiz.create({ data: { lessonId: lesson.id, ...data } });
    }
  }

  if (lesson.type === "ASSIGNMENT") {
    if (!activity || activity.kind !== "ASSIGNMENT")
      throw new Error(
        `Assignment lesson "${lesson.title}" requires complete assignment details.`,
      );
    const existing = await prisma.assignment.findFirst({
      where: { lessonId: lesson.id },
      select: { id: true },
    });
    const data = {
      courseId,
      title: activity.title,
      description: activity.description,
      dueAt: activity.dueAt,
    };
    if (existing) {
      await prisma.assignment.update({ where: { id: existing.id }, data });
    } else {
      await prisma.assignment.create({
        data: { lessonId: lesson.id, ...data },
      });
    }
  }
}

async function removeActivityRecordsForInactiveTypes(
  lessonId: string,
  activeType: string,
) {
  if (activeType !== "LIVE") {
    await prisma.liveSession.updateMany({
      where: { lessonId },
      data: { lessonId: null },
    });
  }
  if (activeType !== "QUIZ") {
    const quizzes = await prisma.quiz.findMany({
      where: { lessonId },
      select: { id: true },
    });
    const quizIds = quizzes.map((quiz) => quiz.id);
    if (quizIds.length)
      await prisma.quizAttempt.deleteMany({
        where: { quizId: { in: quizIds } },
      });
    await prisma.quiz.deleteMany({ where: { lessonId } });
  }
  if (activeType !== "ASSIGNMENT") {
    const assignments = await prisma.assignment.findMany({
      where: { lessonId },
      select: { id: true },
    });
    const assignmentIds = assignments.map((assignment) => assignment.id);
    if (assignmentIds.length)
      await prisma.assignmentSubmission.deleteMany({
        where: { assignmentId: { in: assignmentIds } },
      });
    await prisma.assignment.deleteMany({ where: { lessonId } });
  }
}

function loadTeacherCourse(id: string, instructorId: string) {
  return prisma.course.findFirst({
    where: { id, instructorId },
    include: {
      category: { select: { nameEn: true } },
      reviews: { select: { rating: true } },
      modules: {
        orderBy: { sortOrder: "asc" },
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
      _count: { select: { enrollments: true } },
    },
  });
}

async function mobileTeacherCourse(
  course: NonNullable<Awaited<ReturnType<typeof loadTeacherCourse>>>,
  instructorName: string,
  instructorId: string,
  baseUrl: string,
) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    instructor: instructorName,
    category: course.category?.nameEn ?? "Learning",
    level: course.level,
    imageUrl: course.coverImage ?? "",
    description: course.shortDescription || course.fullDescription,
    rating: course.reviews.length
      ? Number(
          (
            course.reviews.reduce((sum, review) => sum + review.rating, 0) /
            course.reviews.length
          ).toFixed(1),
        )
      : 0,
    students: course._count.enrollments,
    durationMinutes: course.durationMinutes,
    price: Number(course.salePrice ?? course.price ?? 0),
    outcomes: fromJsonArray<string>(course.outcomes),
    featured: course.status === "PUBLISHED",
    status: course.status,
    modules: await Promise.all(
      course.modules.map(async (module) => ({
        id: module.id,
        title: module.title,
        lessons: await Promise.all(
          module.lessons.map(async (lesson) => ({
            id: lesson.id,
            title: lesson.title,
            type: lesson.type,
            durationMinutes: lesson.durationMinutes,
            completed: false,
            ...(await mobileTeacherLessonMedia({
              baseUrl,
              userId: instructorId,
              courseId: course.id,
              lessonId: lesson.id,
              videoUrl: lesson.videoUrl,
              attachmentUrl: lesson.attachmentUrl,
            })),
          })),
        ),
      })),
    ),
  };
}

async function updateCourseDuration(courseId: string) {
  const aggregate = await prisma.lesson.aggregate({
    where: { module: { courseId } },
    _sum: { durationMinutes: true },
  });
  await prisma.course.update({
    where: { id: courseId },
    data: { durationMinutes: aggregate._sum.durationMinutes ?? 0 },
  });
}

function findLesson(
  course: NonNullable<Awaited<ReturnType<typeof loadTeacherCourse>>>,
  lessonId: string,
) {
  return course.modules
    .flatMap((module) => module.lessons.map((lesson) => ({ lesson, module })))
    .find((item) => item.lesson.id === lessonId);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; lessonId: string }> },
) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const { id, lessonId } = await context.params;
  const course = await loadTeacherCourse(id, instructor.id);
  if (!course) return fail("Course not found.", 404);
  if (course.status === "PUBLISHED") {
    return fail(
      "Published courses require review before curriculum changes.",
      422,
    );
  }

  const existing = findLesson(course, lessonId);
  if (!existing) return fail("Lesson not found for this course.", 404);

  const { body, videoFile, attachmentFile } = await readLessonPayload(request);
  const title = String(body.title || "").trim();
  const durationMinutes = Number(body.durationMinutes || 0);
  const contentValue = body.content;
  const content =
    typeof contentValue === "string" ? contentValue.trim() : undefined;
  const lessonType = normalizeLessonType(
    body.lessonType ?? body.type,
    existing.lesson.type,
  );
  if (!lessonType) return fail("Lesson type is invalid.", 422);
  let uploadedVideoUrl: string | null = null;
  let uploadedAttachmentUrl: string | null = null;
  try {
    uploadedVideoUrl = videoFile ? await saveLessonVideo(videoFile) : null;
    uploadedAttachmentUrl = attachmentFile
      ? await saveLessonAttachment(attachmentFile)
      : null;
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Lesson media is invalid.",
      422,
    );
  }
  const videoUrl = uploadedVideoUrl
    ? ({ ok: true, present: true, value: uploadedVideoUrl } as const)
    : optionalUrlUpdate(body, ["videoUrl"], "Lesson video URL");
  if (!videoUrl.ok) return fail(videoUrl.message, 422);
  const attachmentUrl = uploadedAttachmentUrl
    ? ({ ok: true, present: true, value: uploadedAttachmentUrl } as const)
    : optionalUrlUpdate(
        body,
        ["attachmentUrl", "resourceUrl"],
        "Lesson attachment URL",
      );
  if (!attachmentUrl.ok) return fail(attachmentUrl.message, 422);

  if (!title || title.length < 3) return fail("Lesson title is required.", 422);
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 0 ||
    durationMinutes > 600
  ) {
    return fail("Lesson duration is invalid.", 422);
  }
  let activity: LessonActivity = null;
  try {
    activity = parseActivity(
      body,
      lessonType,
      title,
      content ?? existing.lesson.content,
    );
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Lesson activity is invalid.",
      422,
    );
  }

  const updatedLesson = await prisma.lesson.update({
    where: { id: existing.lesson.id },
    data: {
      title,
      type: lessonType,
      durationMinutes,
      ...(content !== undefined ? { content: content || null } : {}),
      ...(videoUrl.present ? { videoUrl: videoUrl.value } : {}),
      ...(attachmentUrl.present ? { attachmentUrl: attachmentUrl.value } : {}),
    },
  });
  await ensureLinkedActivityRecord({
    courseId: course.id,
    lesson: updatedLesson,
    activity,
  });
  await removeActivityRecordsForInactiveTypes(updatedLesson.id, lessonType);
  await updateCourseDuration(course.id);

  const updated = await loadTeacherCourse(course.id, instructor.id);
  if (!updated) return fail("Course not found.", 404);
  return ok(
    await mobileTeacherCourse(
      updated,
      instructor.name,
      instructor.id,
      mobileRequestAppUrl(request),
    ),
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; lessonId: string }> },
) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const { id, lessonId } = await context.params;
  const course = await loadTeacherCourse(id, instructor.id);
  if (!course) return fail("Course not found.", 404);
  if (course.status === "PUBLISHED") {
    return fail(
      "Published courses require review before curriculum changes.",
      422,
    );
  }

  const existing = findLesson(course, lessonId);
  if (!existing) return fail("Lesson not found for this course.", 404);

  await prisma.lesson.delete({ where: { id: existing.lesson.id } });
  await updateCourseDuration(course.id);

  const updated = await loadTeacherCourse(course.id, instructor.id);
  if (!updated) return fail("Course not found.", 404);
  return ok(
    await mobileTeacherCourse(
      updated,
      instructor.name,
      instructor.id,
      mobileRequestAppUrl(request),
    ),
  );
}
