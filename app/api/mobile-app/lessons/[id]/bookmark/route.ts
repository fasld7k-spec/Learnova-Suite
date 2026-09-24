import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

async function enrolledLessonForStudent(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return null;

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId: lesson.module.courseId,
      },
    },
    select: { id: true },
  });

  return enrollment ? lesson : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const { id } = await params;
  const lesson = await enrolledLessonForStudent(student.id, id);
  if (!lesson)
    return fail("Course enrollment is required for this lesson.", 403);

  await prisma.lessonBookmark.upsert({
    where: { userId_lessonId: { userId: student.id, lessonId: id } },
    update: {},
    create: { userId: student.id, lessonId: id },
  });

  return ok({ bookmarked: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const { id } = await params;
  const lesson = await enrolledLessonForStudent(student.id, id);
  if (!lesson)
    return fail("Course enrollment is required for this lesson.", 403);

  await prisma.lessonBookmark.deleteMany({
    where: { userId: student.id, lessonId: id },
  });

  return ok({ bookmarked: false });
}
