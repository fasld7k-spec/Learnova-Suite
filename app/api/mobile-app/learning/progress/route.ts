import { fail, ok } from "@/lib/api";
import { awardAchievement } from "@/lib/achievements";
import { dispatchAddonEvent } from "@/lib/addons";
import { fromJsonArray } from "@/lib/json-fields";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { dispatchPlatformWebhook } from "@/lib/outbound-webhooks";
import { prisma } from "@/lib/prisma";

async function syncLearningPathProgress(
  userId: string,
  changedCourseId: string,
) {
  const pathEnrollments = await prisma.learningPathEnrollment.findMany({
    where: { userId },
  });
  if (!pathEnrollments.length) return;

  const paths = await prisma.learningPath.findMany({
    where: {
      id: { in: pathEnrollments.map((row) => row.learningPathId) },
      active: true,
    },
  });
  const impactedPaths = paths
    .map((path) => ({ path, courseIds: fromJsonArray<string>(path.courseIds) }))
    .filter(({ courseIds }) => courseIds.includes(changedCourseId));
  if (!impactedPaths.length) return;

  const allCourseIds = Array.from(
    new Set(impactedPaths.flatMap(({ courseIds }) => courseIds)),
  );
  const courseEnrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: allCourseIds } },
    select: { courseId: true, progress: true },
  });
  const progressByCourseId = new Map(
    courseEnrollments.map((row) => [row.courseId, row.progress]),
  );

  await Promise.all(
    impactedPaths.map(({ path, courseIds }) => {
      const progress = courseIds.length
        ? Math.round(
            courseIds.reduce(
              (sum, courseId) => sum + (progressByCourseId.get(courseId) || 0),
              0,
            ) / courseIds.length,
          )
        : 0;
      return prisma.learningPathEnrollment.update({
        where: {
          learningPathId_userId: {
            learningPathId: path.id,
            userId,
          },
        },
        data: { progress },
      });
    }),
  );
}

async function advanceLearningGoals(userId: string) {
  const goals = await prisma.learningGoal.findMany({
    where: { userId, completed: false },
    select: { id: true, progress: true, target: true },
  });
  await Promise.all(
    goals.map((goal) => {
      const progress = Math.min(goal.target, goal.progress + 1);
      return prisma.learningGoal.update({
        where: { id: goal.id },
        data: { progress, completed: progress >= goal.target },
      });
    }),
  );
}

async function lessonActivitiesComplete(
  userId: string,
  courseId: string,
  lessonId: string,
) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: { type: true },
  });
  if (!lesson) return { ok: false, message: "Lesson not found." };

  if (lesson.type === "QUIZ") {
    const quizzes = await prisma.quiz.findMany({
      where: { lessonId },
      select: { id: true, title: true },
    });
    if (!quizzes.length) {
      return {
        ok: false,
        message: "This quiz lesson has no quiz linked yet.",
      };
    }
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        passed: true,
        quizId: { in: quizzes.map((quiz) => quiz.id) },
      },
      select: { quizId: true },
    });
    const passedQuizIds = new Set(attempts.map((attempt) => attempt.quizId));
    const missing = quizzes.find((quiz) => !passedQuizIds.has(quiz.id));
    if (missing) {
      return {
        ok: false,
        message: `Pass the quiz "${missing.title}" before marking this lesson complete.`,
      };
    }
  }

  if (lesson.type === "ASSIGNMENT") {
    const assignments = await prisma.assignment.findMany({
      where: { courseId, lessonId },
      select: { id: true, title: true },
    });
    if (!assignments.length) {
      return {
        ok: false,
        message: "This assignment lesson has no assignment linked yet.",
      };
    }
    const submissions = await prisma.assignmentSubmission.findMany({
      where: {
        userId,
        assignmentId: {
          in: assignments.map((assignment) => assignment.id),
        },
      },
      select: { assignmentId: true, grade: true, feedback: true },
    });
    const acceptedAssignmentIds = new Set(
      submissions
        .filter(
          (submission) =>
            submission.grade !== null &&
            !submission.feedback?.startsWith("[NEEDS_REVISION]"),
        )
        .map((submission) => submission.assignmentId),
    );
    const missing = assignments.find(
      (assignment) => !acceptedAssignmentIds.has(assignment.id),
    );
    if (missing) {
      return {
        ok: false,
        message: `Wait until the assignment "${missing.title}" is graded and accepted before marking this lesson complete.`,
      };
    }
  }

  return { ok: true, message: "" };
}

async function courseActivitiesComplete(userId: string, courseId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId } },
    select: { id: true },
  });
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [quizzes, assignments] = await Promise.all([
    lessonIds.length
      ? prisma.quiz.findMany({
          where: { lessonId: { in: lessonIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.assignment.findMany({ where: { courseId }, select: { id: true } }),
  ]);
  const [passedAttempts, submissions] = await Promise.all([
    quizzes.length
      ? prisma.quizAttempt.findMany({
          where: {
            userId,
            passed: true,
            quizId: { in: quizzes.map((quiz) => quiz.id) },
          },
          select: { quizId: true },
        })
      : Promise.resolve([]),
    assignments.length
      ? prisma.assignmentSubmission.findMany({
          where: {
            userId,
            assignmentId: {
              in: assignments.map((assignment) => assignment.id),
            },
          },
          select: { assignmentId: true, grade: true, feedback: true },
        })
      : Promise.resolve([]),
  ]);
  const passedQuizIds = new Set(
    passedAttempts.map((attempt) => attempt.quizId),
  );
  const acceptedAssignmentIds = new Set(
    submissions
      .filter(
        (submission) =>
          submission.grade !== null &&
          !submission.feedback?.startsWith("[NEEDS_REVISION]"),
      )
      .map((submission) => submission.assignmentId),
  );
  return (
    quizzes.every((quiz) => passedQuizIds.has(quiz.id)) &&
    assignments.every((assignment) => acceptedAssignmentIds.has(assignment.id))
  );
}

export async function GET(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: student.id },
    include: {
      course: {
        include: {
          modules: { include: { lessons: { select: { id: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok(
    enrollments.map((enrollment) => {
      const totalLessons = enrollment.course.modules.reduce(
        (sum, module) => sum + module.lessons.length,
        0,
      );
      const completedLessons = Math.round(
        (enrollment.progress / 100) * totalLessons,
      );
      return {
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.title,
        percent: enrollment.progress / 100,
        completedLessons,
        totalLessons,
      };
    }),
  );
}

export async function POST(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const lessonId = String(body.lessonId || "");
  if (!lessonId) return fail("lessonId is required.", 422);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: {
            include: {
              instructor: { select: { name: true } },
              modules: { include: { lessons: { select: { id: true } } } },
            },
          },
        },
      },
    },
  });

  if (!lesson) return fail("Lesson not found.", 404);

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: student.id,
        courseId: lesson.module.course.id,
      },
    },
  });
  if (!enrollment)
    return fail("Course enrollment is required for this lesson.", 403);

  const activities = await lessonActivitiesComplete(
    student.id,
    lesson.module.course.id,
    lessonId,
  );
  if (!activities.ok) return fail(activities.message, 422);

  const existingLessonProgress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: student.id, lessonId } },
    select: { completed: true },
  });

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: student.id, lessonId } },
    update: {
      completed: true,
      completedAt: new Date(),
      lastWatchedAt: new Date(),
    },
    create: {
      userId: student.id,
      lessonId,
      completed: true,
      completedAt: new Date(),
      lastWatchedAt: new Date(),
    },
  });

  const course = lesson.module.course;
  const lessonIds = course.modules.flatMap((module) =>
    module.lessons.map((item) => item.id),
  );
  const completedLessons = await prisma.lessonProgress.count({
    where: {
      userId: student.id,
      lessonId: { in: lessonIds },
      completed: true,
    },
  });
  const totalLessons = Math.max(lessonIds.length, 1);
  const percent = completedLessons / totalLessons;
  const activitiesComplete =
    percent >= 1
      ? await courseActivitiesComplete(student.id, course.id)
      : false;
  const completionPercent =
    percent >= 1 && !activitiesComplete ? 0.99 : percent;

  const updatedEnrollment = await prisma.enrollment.update({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    data: {
      progress: Math.round(completionPercent * 100),
      completedAt:
        percent >= 1 && activitiesComplete
          ? new Date()
          : enrollment.completedAt,
    },
  });

  await syncLearningPathProgress(student.id, course.id);
  if (!existingLessonProgress?.completed)
    await advanceLearningGoals(student.id);

  if (completedLessons === 1 && !existingLessonProgress?.completed) {
    await awardAchievement({
      userId: student.id,
      title: "First Lesson",
      icon: "play",
      reason: `Completed the first lesson in ${course.title}`,
    });
  }

  let certificateIssued = false;
  if (percent >= 1 && activitiesComplete) {
    if (course.includesCertificate) {
      const existingCertificate = await prisma.certificate.findUnique({
        where: { enrollmentId: updatedEnrollment.id },
      });
      const certificate =
        existingCertificate ||
        (await prisma.certificate.create({
          data: {
            code: `CERT-${Date.now()}-${student.id.slice(0, 5)}`,
            userId: student.id,
            enrollmentId: updatedEnrollment.id,
            courseTitle: course.title,
            instructorName: course.instructor.name,
          },
        }));

      if (!existingCertificate) {
        certificateIssued = true;
        const eventPayload = {
          certificateId: certificate.id,
          code: certificate.code,
          userId: student.id,
          courseId: course.id,
          courseTitle: course.title,
          instructorName: course.instructor.name,
          issuedAt: certificate.issuedAt.toISOString(),
        };
        await Promise.allSettled([
          dispatchAddonEvent("certificate.issued", eventPayload),
          dispatchPlatformWebhook("certificate.issued", eventPayload),
        ]);
      }
    }

    await awardAchievement({
      userId: student.id,
      title: "Course Completer",
      icon: "certificate",
      reason: `Completed ${course.title}`,
    });
  }

  return ok({
    courseId: course.id,
    courseTitle: course.title,
    percent: completionPercent,
    completedLessons,
    totalLessons,
    certificateIssued,
  });
}
