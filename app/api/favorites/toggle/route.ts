import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { safeRedirectPath } from '@/lib/safe-redirect';

async function readPayload(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return {
      courseId: typeof body.courseId === 'string' ? body.courseId.trim() : '',
      redirect: safeRedirectPath(typeof body.redirect === 'string' ? body.redirect : '', '/courses'),
      csrfToken: req.headers.get('x-csrf-token') || (typeof body.csrfToken === 'string' ? body.csrfToken : ''),
      wantsJson: true,
    };
  }

  const form = await req.formData().catch(() => new FormData());
  return {
    courseId: String(form.get('courseId') || '').trim(),
    redirect: safeRedirectPath(form.get('redirect'), '/courses'),
    csrfToken: String(form.get('csrfToken') || ''),
    wantsJson: (req.headers.get('accept') || '').includes('application/json'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const { courseId, redirect, csrfToken, wantsJson } = await readPayload(req);
    if (!(await verifyCsrf(csrfToken))) return fail('Invalid CSRF token.', 403);
    if (!courseId) return fail('courseId is required', 422);

    const course = await prisma.course.findFirst({ where: { id: courseId, status: 'PUBLISHED' }, select: { id: true } });
    if (!course) return fail('Course not found', 404);

    const existing = await prisma.favorite.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
    let favorited = false;
    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
    } else {
      await prisma.favorite.create({ data: { userId: user.id, courseId } });
      favorited = true;
    }

    if (wantsJson) return ok({ favorited });
    return NextResponse.redirect(new URL(redirect, req.url), 303);
  } catch (e: any) {
    return handleRouteError(e, req);
  }
}
