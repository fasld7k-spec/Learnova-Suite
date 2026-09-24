import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/student/grants', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData().catch(() => null);
    if (!form) return formError(req, 'Invalid grant application request.');
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const grantId = String(form.get('grantId') || '').trim();
    const statement = String(form.get('statement') || '').trim().slice(0, 2000);

    if (!grantId) return formError(req, 'Choose a grant before applying.');
    if (statement.length < 30) return formError(req, 'Application statement must be at least 30 characters.');
    const grant = await prisma.grantProgram.findFirst({ where: { id: grantId, active: true }, select: { id: true } });
    if (!grant) return formError(req, 'This grant is no longer available.', 404);

    await prisma.grantApplication.upsert({
      where: { grantId_userId: { grantId, userId: user.id } },
      update: { statement, status: 'PENDING' },
      create: { grantId, userId: user.id, statement },
    });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } }).catch(() => []);
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: 'Grant application submitted',
        body: `${user.name} submitted a grant application for review.`,
      })),
    }).catch(() => null);
    return NextResponse.redirect(new URL('/student/grants', req.url), 303);
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED' || e?.message === 'FORBIDDEN') return handleRouteError(e, req);
    return formError(req, e?.message || 'Unable to submit grant application.', 500);
  }
}
