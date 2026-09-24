import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function mobileReview(review: {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: { name: string };
}) {
  return {
    id: review.id,
    name: review.user.name,
    rating: review.rating,
    body: review.comment ?? "",
    createdAt: review.createdAt.toISOString(),
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
  const rating = Number(body.rating);
  const comment = String(body.comment || "")
    .trim()
    .slice(0, 1200);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail("Invalid rating", 422);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
  });
  if (!enrollment)
    return fail("Only enrolled learners can review this course", 403);
  if (!enrollment.completedAt && enrollment.progress < 20) {
    return fail(
      "Reviews unlock after reaching at least 20% course progress.",
      403,
    );
  }

  const review = await prisma.review.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: { rating, comment: comment || null },
    create: {
      userId: student.id,
      courseId: course.id,
      rating,
      comment: comment || null,
    },
    include: { user: { select: { name: true } } },
  });

  return ok(mobileReview(review), 201);
}
