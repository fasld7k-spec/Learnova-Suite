import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import {
  createAssignmentSubmissionAccessUrl,
  createCourseResourceAccessUrl,
  createLessonMediaAccessUrl,
} from "@/lib/content-protection";
import { resolveAppUrl } from "@/lib/app-url";
import { fromJsonArray } from "@/lib/json-fields";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";
import { isLessonDripUnlocked } from "@/lib/drip-access";

type QuizQuestion = {
  q?: string;
  type?: string;
  options?: string[];
};

function mobileQuizQuestion(question: QuizQuestion, index: number) {
  return {
    id: String(index),
    prompt: String(question.q || `Question ${index + 1}`),
    type: question.type || "mcq",
    options: Array.isArray(question.options)
      ? question.options.map(String)
      : [],
  };
}

function mobileSubmissionStatus(submission?: {
  grade: number | null;
  feedback: string | null;
}) {
  if (!submission) return "not_submitted";
  if (submission.grade === null) return "pending_review";
  if (submission.feedback?.startsWith("[NEEDS_REVISION]"))
    return "needs_revision";
  return "accepted";
}

function absoluteMediaUrl(baseUrl: string, value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//"))
    return `${baseUrl}${value}`;
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const { id } = await params;
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      module: {
        include: {
          course: {
            include: {
              modules: {
                orderBy: { sortOrder: "asc" },
                include: {
                  lessons: { orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      },
      progresses: {
        where: { userId: student.id },
        select: { completed: true, lastPositionSeconds: true },
        take: 1,
      },
    },
  });

  if (!lesson) return fail("Lesson not found", 404);

  const course = lesson.module.course;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    select: { id: true },
  });
  if (!lesson.isPreview && !enrollment) {
    return fail("Course enrollment is required for this lesson.", 403);
  }
  if (!lesson.isPreview && !(await isLessonDripUnlocked({ userId: student.id, courseId: course.id, lessonId: lesson.id }))) {
    return fail("Lesson is not unlocked yet.", 403);
  }

  const [resources, bookmark, quizzes, assignments] = await Promise.all([
    prisma.courseResource.findMany({
      where: { courseId: course.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.lessonBookmark.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lesson.id } },
      select: { id: true },
    }),
    prisma.quiz.findMany({
      where: { lessonId: lesson.id },
      orderBy: { createdAt: "asc" },
      include: {
        attempts: {
          where: { userId: student.id },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.assignment.findMany({
      where: { courseId: course.id, lessonId: lesson.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const assignmentSubmissions = assignments.length
    ? await prisma.assignmentSubmission.findMany({
        where: {
          userId: student.id,
          assignmentId: {
            in: assignments.map((assignment) => assignment.id),
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const flatLessons = course.modules.flatMap((module) => module.lessons);
  const lessonIndex = flatLessons.findIndex((item) => item.id === lesson.id);
  const previousLesson = lessonIndex > 0 ? flatLessons[lessonIndex - 1] : null;
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < flatLessons.length - 1
      ? flatLessons[lessonIndex + 1]
      : null;
  const appUrl = resolveAppUrl({
    headers: request.headers,
    requestOrigin: request.nextUrl.origin,
  });
  const videoUrl = absoluteMediaUrl(
    appUrl,
    await createLessonMediaAccessUrl({
      userId: student.id,
      courseId: course.id,
      lessonId: lesson.id,
      kind: "lesson-video",
      url: lesson.videoUrl,
    }),
  );
  const attachmentUrl = absoluteMediaUrl(
    appUrl,
    await createLessonMediaAccessUrl({
      userId: student.id,
      courseId: course.id,
      lessonId: lesson.id,
      kind: "lesson-attachment",
      url: lesson.attachmentUrl,
    }),
  );
  const resourceItems = await Promise.all(
    resources.map(async (resource) => ({
      id: resource.id,
      title: resource.title,
      type: resource.type,
      url: absoluteMediaUrl(
        appUrl,
        await createCourseResourceAccessUrl({
          userId: student.id,
          courseId: course.id,
          resourceId: resource.id,
          url: resource.url,
        }),
      ),
    })),
  );
  const submissionFileUrls = new Map(
    await Promise.all(
      assignmentSubmissions.map(
        async (submission) =>
          [
            submission.id,
            absoluteMediaUrl(
              appUrl,
              await createAssignmentSubmissionAccessUrl({
                userId: student.id,
                courseId: course.id,
                submissionId: submission.id,
                url: submission.fileUrl,
              }),
            ),
          ] as const,
      ),
    ),
  );

  return ok({
    lesson: {
      id: lesson.id,
      title: lesson.title,
      durationMinutes: lesson.durationMinutes,
      completed: lesson.progresses.some((progress) => progress.completed),
      videoUrl,
      resourceUrl: attachmentUrl,
    },
    courseId: course.id,
    courseTitle: course.title,
    moduleTitle: lesson.module.title,
    transcript:
      lesson.content ||
      `00:00 ${lesson.title}. 02:10 Key concepts. 07:45 Apply this lesson inside ${course.title}.`,
    resources: [
      ...resourceItems,
      ...(attachmentUrl
        ? [
            {
              id: `${lesson.id}-attachment`,
              title: `${lesson.title} attachment`,
              type: "ATTACHMENT",
              url: attachmentUrl,
            },
          ]
        : []),
    ],
    previousLessonId: previousLesson?.id ?? null,
    nextLessonId: nextLesson?.id ?? null,
    enrolled: Boolean(enrollment),
    bookmarked: Boolean(bookmark),
    quizzes: quizzes.map((quiz) => {
      const latestAttempt = quiz.attempts[0];
      return {
        id: quiz.id,
        lessonId: quiz.lessonId,
        title: quiz.title,
        passingScore: quiz.passingScore,
        questions: fromJsonArray<QuizQuestion>(quiz.questions).map(
          mobileQuizQuestion,
        ),
        latestAttempt: latestAttempt
          ? {
              id: latestAttempt.id,
              score: latestAttempt.score,
              passed: latestAttempt.passed,
              createdAt: latestAttempt.createdAt.toISOString(),
            }
          : null,
      };
    }),
    assignments: assignments.map((assignment) => {
      const latestSubmission = assignmentSubmissions.find(
        (submission) => submission.assignmentId === assignment.id,
      );
      return {
        id: assignment.id,
        courseId: assignment.courseId,
        lessonId: assignment.lessonId,
        title: assignment.title,
        description: assignment.description,
        dueAt: assignment.dueAt?.toISOString() ?? null,
        latestSubmission: latestSubmission
          ? {
              id: latestSubmission.id,
              content: latestSubmission.content,
              fileUrl: submissionFileUrls.get(latestSubmission.id) ?? null,
              grade: latestSubmission.grade,
              feedback: latestSubmission.feedback,
              status: mobileSubmissionStatus(latestSubmission),
              createdAt: latestSubmission.createdAt.toISOString(),
            }
          : null,
      };
    }),
  });
}
