import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/student/scholarships', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData().catch(() => null);
    if (!form) return formError(req, 'Invalid scholarship application request.');
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const scholarshipId = String(form.get('scholarshipId') || '').trim();
    const statement = String(form.get('statement') || '').trim().slice(0, 2000);

    if (!scholarshipId) return formError(req, 'Choose a scholarship before applying.');
    if (statement.length < 30) return formError(req, 'Application statement must be at least 30 characters.');
    const scholarship = await prisma.scholarship.findFirst({ where: { id: scholarshipId, active: true }, select: { id: true } });
    if (!scholarship) return formError(req, 'This scholarship is no longer available.', 404);

    await prisma.scholarshipApplication.upsert({
      where: { scholarshipId_userId: { scholarshipId, userId: user.id } },
      update: { statement, status: 'PENDING' },
      create: { scholarshipId, userId: user.id, statement },
    });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } }).catch(() => []);
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: 'Scholarship application submitted',
        body: `${user.name} submitted a scholarship application for review.`,
      })),
    }).catch(() => null);
    return NextResponse.redirect(new URL('/student/scholarships', req.url), 303);
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED' || e?.message === 'FORBIDDEN') return handleRouteError(e, req);
    return formError(req, e?.message || 'Unable to submit scholarship application.', 500);
  }
}
