import { NextRequest, NextResponse } from 'next/server';
import { fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { formFail, wantsJson } from '@/lib/form-response';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  let redirectPath = '/cohorts';

  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    const cohortId = String(form.get('cohortId') || '').trim();
    redirectPath = `/cohorts${cohortId ? `#cohort-${cohortId}` : ''}`;

    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formFail(req, 'Invalid CSRF token.', 403, redirectPath);
    if (!cohortId) return formFail(req, 'Cohort is required.', 422, redirectPath);

    const cohort = await prisma.courseCohort.findFirst({
      where: { id: cohortId, startsAt: { gte: new Date() } },
      select: { id: true, courseId: true, seats: true },
    });
    if (!cohort) return formFail(req, 'Cohort is not available.', 404, '/cohorts');

    const enrollmentCount = await prisma.cohortEnrollment.count({ where: { cohortId } });
    if (cohort.seats > 0 && enrollmentCount >= cohort.seats) {
      return formFail(req, 'This cohort is fully booked.', 409, redirectPath);
    }

    const courseEnrollment = await prisma.enrollment.findFirst({
      where: { userId: user.id, courseId: cohort.courseId },
      select: { id: true },
    });
    if (!courseEnrollment) return formFail(req, 'Enroll in the course before joining its cohort.', 403, redirectPath);

    const enrollment = await prisma.cohortEnrollment.upsert({
      where: { cohortId_userId: { cohortId, userId: user.id } },
      update: {},
      create: { cohortId, userId: user.id },
    });

    if (wantsJson(req)) return ok({ cohortEnrollment: enrollment });
    const url = new URL(redirectPath, req.url);
    url.searchParams.set('joined', '1');
    return NextResponse.redirect(url, 303);
  } catch (error: any) {
    if (error?.message === 'UNAUTHENTICATED') {
      if (wantsJson(req)) return fail('Unauthenticated', 401);
      const url = new URL('/login', req.url);
      url.searchParams.set('redirect', redirectPath);
      return NextResponse.redirect(url, 303);
    }
    return formFail(req, error?.message || 'Unable to join cohort.', 500, redirectPath);
  }
}
