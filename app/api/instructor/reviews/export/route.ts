import { NextRequest } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const instructor = await requireApprovedInstructor();
  const reviews = await prisma.review.findMany({
    where: { course: { instructorId: instructor.id } },
    include: {
      course: { select: { title: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const csv = toCsv(
    ['Course', 'Student', 'Student Email', 'Rating', 'Comment', 'Created At'],
    reviews.map((review) => [
      review.course.title,
      review.user.name,
      review.user.email,
      review.rating,
      review.comment || '',
      review.createdAt.toISOString(),
    ]),
  );

  return csvResponse(`instructor-reviews-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
