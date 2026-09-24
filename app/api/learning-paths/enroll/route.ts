import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/learning-paths', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData().catch(() => null);
    if (!form) return formError(req, 'Invalid learning path enrollment request.');
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const learningPathId = String(form?.get('learningPathId') || '').trim();

    if (!learningPathId) return formError(req, 'Choose a learning path before enrolling.');
    const path = await prisma.learningPath.findFirst({ where: { id: learningPathId, active: true }, select: { id: true } });
    if (!path) return formError(req, 'This learning path is no longer available.', 404);

    await prisma.learningPathEnrollment.upsert({
      where: { learningPathId_userId: { learningPathId, userId: user.id } },
      update: {},
      create: { learningPathId, userId: user.id },
    });

    return NextResponse.redirect(new URL('/student/learning-paths', req.url), 303);
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED' || e?.message === 'FORBIDDEN') return handleRouteError(e, req);
    return formError(req, e?.message || 'Unable to enroll in this learning path.', 500);
  }
}
