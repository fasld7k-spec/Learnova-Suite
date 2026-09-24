import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const instructor = await requireApprovedInstructor();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const action = String(form.get('_action') || '').trim();
    const reviewId = String(form.get('reviewId') || '').trim();
    if (!reviewId) return fail('Review ID is required.', 422);

    const review = await prisma.review.findFirst({
      where: { id: reviewId, course: { instructorId: instructor.id } },
      include: {
        course: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
    });
    if (!review) return fail('Review not found.', 404);

    if (action === 'note') {
      const note = String(form.get('note') || '').trim().slice(0, 2000);
      if (!note) return fail('Follow-up note is required.', 422);

      await prisma.adminNote.create({
        data: {
          entity: 'review',
          entityId: review.id,
          adminId: instructor.id,
          note: `[Instructor follow-up] ${note}`,
        },
      });
      await audit({
        actorId: instructor.id,
        action: 'instructor.review.note',
        entity: 'review',
        entityId: review.id,
        metadata: { courseId: review.courseId, rating: review.rating },
      });

      return NextResponse.redirect(new URL('/instructor/reviews?saved=1', req.url), 303);
    }

    if (action === 'notify') {
      const body = String(form.get('body') || '').trim().slice(0, 500);
      if (!body) return fail('Student message is required.', 422);

      await prisma.$transaction([
        prisma.notification.create({
          data: {
            userId: review.userId,
            title: `Instructor reply: ${review.course.title}`,
            body,
          },
        }),
        prisma.adminNote.create({
          data: {
            entity: 'review',
            entityId: review.id,
            adminId: instructor.id,
            note: `[Instructor student notification] ${body}`,
          },
        }),
      ]);
      await audit({
        actorId: instructor.id,
        action: 'instructor.review.notify_student',
        entity: 'review',
        entityId: review.id,
        metadata: { courseId: review.courseId, studentId: review.userId },
      });

      return NextResponse.redirect(new URL('/instructor/reviews?sent=1', req.url), 303);
    }

    return fail('Unsupported review action.', 422);
  } catch (error) {
    return handleRouteError(error, req);
  }
}
