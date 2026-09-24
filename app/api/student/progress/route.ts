import { NextRequest, NextResponse } from 'next/server';
import { awardAchievement } from '@/lib/achievements';
import { dispatchAddonEvent } from '@/lib/addons';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { isLessonDripUnlocked } from '@/lib/drip-access';
import { enrolledCourseForLesson } from '@/lib/enrollment';
import { dispatchPlatformWebhook } from '@/lib/outbound-webhooks';
import { prisma } from '@/lib/prisma';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { fromJsonArray } from '@/lib/json-fields';
import { formFail } from '@/lib/form-response';

async function syncLearningPathProgress(userId: string, changedCourseId: string) {
  const pathEnrollments = await prisma.learningPathEnrollment.findMany({ where: { userId } });
  if (!pathEnrollments.length) return;

  const paths = await prisma.learningPath.findMany({
    where: { id: { in: pathEnrollments.map((row) => row.learningPathId) }, active: true }
  });
  const impactedPaths = paths
    .map((path) => ({ path, courseIds: fromJsonArray<string>(path.courseIds) }))
    .filter(({ courseIds }) => courseIds.includes(changedCourseId));
  if (!impactedPaths.length) return;

  const allCourseIds = Array.from(new Set(impactedPaths.flatMap(({ courseIds }) => courseIds)));
  const courseEnrollments = await prisma.enrollment.findMany({
    where: { userId, courseId: { in: allCourseIds } },
    select: { courseId: true, progress: true }
  });
  const progressByCourseId = new Map(courseEnrollments.map((row) => [row.courseId, row.progress]));

  await Promise.all(
    impactedPaths.map(({ path, courseIds }) => {
      const progress = courseIds.length
        ? Math.round(courseIds.reduce((sum, courseId) => sum + (progressByCourseId.get(courseId) || 0), 0) / courseIds.length)
        : 0;
      return prisma.learningPathEnrollment.update({
        where: { learningPathId_userId: { learningPathId: path.id, userId } },
        data: { progress }
      });
    })
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

function isExternalEmbed(url: string | null) {
  if (!url) return false;
  return /iframe\.mediadelivery\.net\/embed\//i.test(url) || /player\.vimeo\.com\/video\//i.test(url) || /youtube(-nocookie)?\.com\/embed\//i.test(url);
}

async function assertLessonActivitiesComplete(userId: string, courseId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: { id: true, type: true, durationMinutes: true, videoUrl: true }
  });
  if (!lesson) throw new Error('Lesson not found');

  if (lesson.type === 'VIDEO' && !isExternalEmbed(lesson.videoUrl)) {
    const requiredSeconds = lesson.durationMinutes
      ? Math.max(20, Math.floor(lesson.durationMinutes * 60 * 0.8))
      : 20;
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { watchSeconds: true }
    });
    if ((progress?.watchSeconds || 0) < requiredSeconds) {
      throw new Error(`Watch at least ${Math.ceil(requiredSeconds / 60)} minute(s) of this video before marking it complete.`);
    }
  }

  if (lesson.type === 'LIVE') {
    const sessions = await prisma.liveSession.findMany({
      where: { courseId, lessonId },
      select: { id: true, title: true, startsAt: true, durationMinutes: true }
    });
    if (!sessions.length) throw new Error('This live lesson has no live session linked yet.');
    const now = Date.now();
    const endedSessionIds = sessions
      .filter((session) => session.startsAt.getTime() + session.durationMinutes * 60 * 1000 <= now)
      .map((session) => session.id);
    if (!endedSessionIds.length) throw new Error('This live lesson can be completed after its session ends.');
    const attendance = await prisma.liveSessionAttendance.findFirst({
      where: { userId, liveSessionId: { in: endedSessionIds } },
      select: { id: true }
    });
    if (!attendance) throw new Error('Join the live session before marking this lesson complete.');
  }

  if (lesson.type === 'QUIZ') {
    const quizzes = await prisma.quiz.findMany({ where: { lessonId }, select: { id: true, title: true } });
    if (!quizzes.length) throw new Error('This quiz lesson has no quiz linked yet.');
    const passed = await prisma.quizAttempt.findMany({
      where: { userId, passed: true, quizId: { in: quizzes.map((quiz) => quiz.id) } },
      select: { quizId: true }
    });
    const passedQuizIds = new Set(passed.map((attempt) => attempt.quizId));
    const missing = quizzes.find((quiz) => !passedQuizIds.has(quiz.id));
    if (missing) throw new Error(`Pass the quiz "${missing.title}" before marking this lesson complete.`);
  }

  if (lesson.type === 'ASSIGNMENT') {
    const assignments = await prisma.assignment.findMany({ where: { courseId, lessonId }, select: { id: true, title: true } });
    if (!assignments.length) throw new Error('This assignment lesson has no assignment linked yet.');
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { userId, assignmentId: { in: assignments.map((assignment) => assignment.id) } },
      select: { assignmentId: true, grade: true, feedback: true }
    });
    const acceptedAssignmentIds = new Set(
      submissions
        .filter((submission) => submission.grade !== null && !submission.feedback?.startsWith('[NEEDS_REVISION]'))
        .map((submission) => submission.assignmentId)
    );
    const missing = assignments.find((assignment) => !acceptedAssignmentIds.has(assignment.id));
    if (missing) throw new Error(`Wait until the assignment "${missing.title}" is graded and accepted before marking this lesson complete.`);
  }
}

async function courseActivitiesComplete(userId: string, courseId: string) {
  const lessons = await prisma.lesson.findMany({ where: { module: { courseId } }, select: { id: true } });
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [quizzes, assignments] = await Promise.all([
    lessonIds.length ? prisma.quiz.findMany({ where: { lessonId: { in: lessonIds } }, select: { id: true } }) : Promise.resolve([]),
    prisma.assignment.findMany({ where: { courseId }, select: { id: true } })
  ]);
  const [passedAttempts, submissions] = await Promise.all([
    quizzes.length
      ? prisma.quizAttempt.findMany({ where: { userId, passed: true, quizId: { in: quizzes.map((quiz) => quiz.id) } }, select: { quizId: true } })
      : Promise.resolve([]),
    assignments.length
      ? prisma.assignmentSubmission.findMany({ where: { userId, assignmentId: { in: assignments.map((assignment) => assignment.id) } }, select: { assignmentId: true, grade: true, feedback: true } })
      : Promise.resolve([])
  ]);
  const passedQuizIds = new Set(passedAttempts.map((attempt) => attempt.quizId));
  const acceptedAssignmentIds = new Set(
    submissions
      .filter((submission) => submission.grade !== null && !submission.feedback?.startsWith('[NEEDS_REVISION]'))
      .map((submission) => submission.assignmentId)
  );
  return quizzes.every((quiz) => passedQuizIds.has(quiz.id))
    && assignments.every((assignment) => acceptedAssignmentIds.has(assignment.id));
}

export async function POST(req: NextRequest) {
  let redirectPath = '/student/courses';
  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formFail(req, 'Invalid CSRF token.', 403, redirectPath);
    const lessonId = String(form.get('lessonId') || '');
    const courseId = String(form.get('courseId') || '');
    const redirectTo = String(form.get('redirect') || '');
    redirectPath = safeRedirectPath(redirectTo, redirectPath);
    const enrolledCourseId = await enrolledCourseForLesson(user.id, lessonId);
    if (!enrolledCourseId || enrolledCourseId !== courseId) return formFail(req, 'Lesson not found', 404, redirectPath);
    if (!(await isLessonDripUnlocked({ userId: user.id, courseId, lessonId }))) return formFail(req, 'Lesson is not unlocked yet.', 403, redirectPath);
    await assertLessonActivitiesComplete(user.id, courseId, lessonId);
    const existingLessonProgress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      select: { completed: true },
    });

    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      update: { completed: true, completedAt: new Date() },
      create: { userId: user.id, lessonId, completed: true, completedAt: new Date() },
    });

    const total = await prisma.lesson.count({ where: { module: { courseId } } });
    const done = await prisma.lessonProgress.count({
      where: { userId: user.id, completed: true, lesson: { module: { courseId } } },
    });
    const progress = total ? Math.round((done / total) * 100) : 0;
    const activitiesComplete = progress >= 100 ? await courseActivitiesComplete(user.id, courseId) : false;
    const completionProgress = progress >= 100 && !activitiesComplete ? 99 : progress;

    const enrollment = await prisma.enrollment.update({
      where: { userId_courseId: { userId: user.id, courseId } },
      data: { progress: completionProgress, completedAt: progress >= 100 && activitiesComplete ? new Date() : undefined },
      include: { course: { include: { instructor: true } } },
    });

    await syncLearningPathProgress(user.id, courseId);
    if (!existingLessonProgress?.completed) await advanceLearningGoals(user.id);

    if (done === 1) {
      await awardAchievement({
        userId: user.id,
        title: 'First Lesson',
        icon: 'play',
        reason: `Completed the first lesson in ${enrollment.course.title}`,
      });
    }

    if (progress >= 100 && activitiesComplete) {
      if (enrollment.course.includesCertificate) {
        const existingCertificate = await prisma.certificate.findUnique({ where: { enrollmentId: enrollment.id } });
        const certificate = existingCertificate || await prisma.certificate.create({
          data: {
            code: `CERT-${Date.now()}-${user.id.slice(0, 5)}`,
            userId: user.id,
            enrollmentId: enrollment.id,
            courseTitle: enrollment.course.title,
            instructorName: enrollment.course.instructor.name,
          },
        });

        if (!existingCertificate) {
          const eventPayload = {
            certificateId: certificate.id,
            code: certificate.code,
            userId: user.id,
            courseId,
            courseTitle: enrollment.course.title,
            instructorName: enrollment.course.instructor.name,
            issuedAt: certificate.issuedAt.toISOString(),
          };
          await Promise.allSettled([
            dispatchAddonEvent('certificate.issued', eventPayload),
            dispatchPlatformWebhook('certificate.issued', eventPayload),
          ]);
        }
      }

      await awardAchievement({
        userId: user.id,
        title: 'Course Completer',
        icon: 'certificate',
        reason: `Completed ${enrollment.course.title}`,
      });
    }

    return NextResponse.redirect(new URL(safeRedirectPath(redirectTo, `/learn/${enrollment.course.slug}`), req.url), 303);
  } catch (error: any) {
    const message = error?.message || 'Unable to update progress';
    const expectedActivityGate = /Pass the quiz|Submit the assignment|graded and accepted|has no quiz linked|has no assignment linked|Watch at least|live lesson|Join the live session/i.test(message);
    return formFail(req, message, expectedActivityGate ? 422 : 500, redirectPath);
  }
}
