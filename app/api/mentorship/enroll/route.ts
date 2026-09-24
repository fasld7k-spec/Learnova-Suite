import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/student/mentorship', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData().catch(() => null);
    if (!form) return formError(req, 'Invalid mentorship enrollment request.');
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const programId = String(form.get('programId') || '').trim();

    if (!programId) return formError(req, 'Choose a mentorship program before enrolling.');
    const program = await prisma.mentorProgram.findFirst({ where: { id: programId, active: true }, select: { id: true } });
    if (!program) return formError(req, 'This mentorship program is no longer available.', 404);

    await prisma.mentorEnrollment.upsert({
      where: { programId_userId: { programId, userId: user.id } },
      update: {},
      create: { programId, userId: user.id },
    });
    return NextResponse.redirect(new URL('/student/mentorship', req.url), 303);
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED' || e?.message === 'FORBIDDEN') return handleRouteError(e, req);
    return formError(req, e?.message || 'Unable to enroll in mentorship.', 500);
  }
}
