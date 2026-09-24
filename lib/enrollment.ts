import { prisma } from '@/lib/prisma';

export async function isEnrolled(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true }
  });
  return !!enrollment;
}

export async function enrolledCourseForLesson(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } }
  });
  if (!lesson) return null;
  return (await isEnrolled(userId, lesson.module.courseId)) ? lesson.module.courseId : null;
}
