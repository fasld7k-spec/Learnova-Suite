import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function mobileQuestion(question: {
  id: string;
  title: string;
  body: string;
  answer: string | null;
  helpfulCount: number;
  createdAt: Date;
  user: { name: string };
}) {
  return {
    id: question.id,
    name: question.user.name,
    title: question.title,
    body: question.body,
    answer: question.answer,
    helpfulCount: question.helpfulCount,
    createdAt: question.createdAt.toISOString(),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const { id } = await params;
  const course = await prisma.course.findFirst({
    where: { OR: [{ id }, { slug: id }], status: "PUBLISHED" },
    select: { id: true },
  });
  if (!course) return fail("Course not found", 404);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "")
    .trim()
    .slice(0, 180);
  const questionBody = String(body.body || "")
    .trim()
    .slice(0, 2000);
  const requestedLessonId = String(body.lessonId || "").trim();
  if (!title || !questionBody) {
    return fail("Question title and body are required.", 422);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
  });
  if (!enrollment)
    return fail("Only enrolled learners can ask course questions", 403);

  const lessonId = requestedLessonId
    ? ((
        await prisma.lesson.findFirst({
          where: { id: requestedLessonId, module: { courseId: course.id } },
          select: { id: true },
        })
      )?.id ?? null)
    : null;
  if (requestedLessonId && !lessonId) {
    return fail("Lesson not found for this course.", 404);
  }

  const question = await prisma.question.create({
    data: {
      userId: student.id,
      courseId: course.id,
      lessonId,
      title,
      body: questionBody,
    },
    include: { user: { select: { name: true } } },
  });

  return ok(mobileQuestion(question), 201);
}
