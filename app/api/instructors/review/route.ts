import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const body = await req.json().catch(() => null);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String(body?.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const instructorId = String(body?.instructorId || '').trim();
    const rating = Number(body?.rating);
    const comment = String(body?.comment || '').trim().slice(0, 1200);

    if (!instructorId) return fail('Instructor id is required.', 422);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return fail('Invalid rating', 422);

    const instructor = await prisma.user.findFirst({
      where: { id: instructorId, role: 'INSTRUCTOR', status: 'APPROVED' },
      select: { id: true },
    });
    if (!instructor) return fail('Instructor not found', 404);

    const [enrollment, completedBooking] = await Promise.all([
      prisma.enrollment.findFirst({
        where: {
          userId: user.id,
          course: { instructorId: instructor.id },
        },
        select: { id: true },
      }),
      prisma.booking.findFirst({
        where: { studentId: user.id, instructorId: instructor.id, status: 'COMPLETED' },
        select: { id: true },
      }),
    ]);
    if (!enrollment && !completedBooking) return fail('You can review instructors after enrolling in one of their courses or completing a live booking.', 403);

    return ok(await prisma.instructorReview.upsert({
      where: { instructorId_userId: { instructorId: instructor.id, userId: user.id } },
      update: { rating, comment },
      create: { instructorId: instructor.id, userId: user.id, rating, comment },
    }));
  } catch (e) {
    return handleError(e);
  }
}
