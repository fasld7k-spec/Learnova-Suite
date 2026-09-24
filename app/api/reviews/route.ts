import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError, handleRouteError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { dispatchEmail } from '@/lib/email';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { appUrlFromRequest } from '@/lib/app-url';
import { invalidateCourseCatalogCache } from '@/lib/cache';

async function payload(req: NextRequest) {
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return { ...body, csrfToken: req.headers.get('x-csrf-token') || body.csrfToken || '' };
  }
  const form = await req.formData().catch(() => new FormData());
  return {
    courseId: String(form.get('courseId') || '').trim(),
    rating: Number(form.get('rating') || 0),
    comment: String(form.get('comment') || '').trim().slice(0, 1200),
    redirect: String(form.get('redirect') || ''),
    csrfToken: String(form.get('csrfToken') || ''),
  };
}

export async function POST(req: NextRequest) {
  const body = await payload(req);
  try {
    const user = await requireUser();
    if (!(await verifyCsrf(String(body.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    if (user.role !== 'STUDENT') return fail('Student account required to review courses', 403);
    const rating = Number(body.rating);
    if (!body.courseId) return fail('courseId is required', 422);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail('Invalid rating', 422);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: body.courseId } },
    });
    if (!enrollment) return fail('Only enrolled buyers can review this course', 403);
    if (!enrollment.completedAt && enrollment.progress < 20) {
      return fail('Reviews unlock after reaching at least 20% course progress.', 403);
    }

    const review = await prisma.review.upsert({
      where: { userId_courseId: { userId: user.id, courseId: body.courseId } },
      update: { rating, comment: body.comment || null },
      create: { userId: user.id, courseId: body.courseId, rating, comment: body.comment || null },
      include: {
        course: { include: { instructor: { select: { name: true, email: true, locale: true } } } },
      },
    });
    await invalidateCourseCatalogCache();

    // Req 9.7: send review-received notification to instructor
    const appUrl = appUrlFromRequest(req);
    void dispatchEmail({
      to: review.course.instructor.email,
      templateKey: 'review-received',
      variables: {
        instructorName: review.course.instructor.name,
        studentName: user.name,
        courseTitle: review.course.title,
        rating: String(rating),
        comment: body.comment || '',
        reviewsUrl: `${appUrl}/instructor/reviews`,
      },
      locale: review.course.instructor.locale,
    });

    if (body.redirect) return NextResponse.redirect(new URL(safeRedirectPath(body.redirect, '/courses'), req.url), 303);
    return ok(review);
  } catch (e) {
    if (body?.redirect && (e as Error)?.message === 'FORBIDDEN') {
      const url = new URL(safeRedirectPath(body.redirect, '/courses'), req.url);
      url.searchParams.set('reviewStatus', 'student-required');
      return NextResponse.redirect(url, 303);
    }
    if (body?.redirect && (e as Error)?.message === 'UNAUTHENTICATED') {
      return handleRouteError(e, req);
    }
    return handleError(e);
  }
}
