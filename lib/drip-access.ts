import { prisma } from '@/lib/prisma';

type LessonDripAccessInput = {
  userId: string;
  courseId: string;
  lessonId: string | null | undefined;
};

export async function isLessonDripUnlocked({ userId, courseId, lessonId }: LessonDripAccessInput) {
  if (!lessonId) return true;

  const [lesson, enrollment, schedule] = await Promise.all([
    prisma.lesson.findFirst({ where: { id: lessonId, module: { courseId } }, select: { isPreview: true } }),
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { createdAt: true } }),
    prisma.dripSchedule.findFirst({ where: { courseId, lessonId }, orderBy: { createdAt: 'desc' } }),
  ]);

  if (!lesson || !enrollment) return false;
  if (lesson.isPreview || !schedule || schedule.unlockDay <= 0) return true;

  const unlockAt = new Date(enrollment.createdAt);
  unlockAt.setDate(unlockAt.getDate() + schedule.unlockDay);
  return unlockAt <= new Date();
}
