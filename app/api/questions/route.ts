import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError, handleRouteError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { safeRedirectPath } from '@/lib/safe-redirect';

async function payload(req: NextRequest) {
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) return { ...(await req.json().catch(() => ({}))), isJson: true };
  const form = await req.formData().catch(() => new FormData());
  return {
    csrfToken: String(form.get('csrfToken') || ''),
    courseId: String(form.get('courseId') || '').trim(),
    lessonId: String(form.get('lessonId') || '').trim(),
    title: String(form.get('title') || '').trim().slice(0, 180),
    body: String(form.get('body') || '').trim().slice(0, 2000),
    redirect: String(form.get('redirect') || ''),
    isJson: false,
  };
}

export async function POST(req: NextRequest) {
  const body = await payload(req);
  try {
    const user = await requireUser();
    if (user.role !== 'STUDENT') return fail('Student account required to ask course questions', 403);
    if (!body.isJson && !(await verifyCsrf(String(body.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    if (!body.courseId || !body.title?.trim() || !body.body?.trim()) return fail('Course, title and question body are required', 422);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: body.courseId } },
    });
    if (!enrollment) return fail('Only enrolled buyers can ask course questions', 403);
    const lessonId = body.lessonId
      ? (await prisma.lesson.findFirst({
          where: { id: body.lessonId, module: { courseId: body.courseId } },
          select: { id: true },
        }))?.id || null
      : null;
    if (body.lessonId && !lessonId) return fail('Lesson not found for this course.', 404);

    const question = await prisma.question.create({
      data: {
        userId: user.id,
        courseId: body.courseId,
        lessonId,
        title: body.title.trim(),
        body: body.body.trim(),
      },
    });

    if (body.redirect) return NextResponse.redirect(new URL(safeRedirectPath(body.redirect, '/student/my-courses'), req.url), 303);
    return ok(question);
  } catch (e) {
    if (body?.redirect && (e as Error)?.message === 'FORBIDDEN') {
      const url = new URL(safeRedirectPath(body.redirect, '/courses'), req.url);
      url.searchParams.set('questionStatus', 'student-required');
      return NextResponse.redirect(url, 303);
    }
    if (body?.redirect && (e as Error)?.message === 'UNAUTHENTICATED') {
      return handleRouteError(e, req);
    }
    return handleError(e);
  }
}
