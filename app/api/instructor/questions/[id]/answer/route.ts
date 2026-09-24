import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail, handleRouteError } from '@/lib/api';
import { dispatchEmail } from '@/lib/email';
import { appUrlFromRequest } from '@/lib/app-url';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['INSTRUCTOR', 'ADMIN']);
    if (user.role === 'INSTRUCTOR' && user.status !== 'APPROVED') return fail('Forbidden', 403);
    const { id } = await params;
    const type = req.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await req.json().catch(() => ({})) : null;
    const form = type.includes('application/json') ? null : await req.formData().catch(() => new FormData());
    const csrfToken = type.includes('application/json') ? String(payload?.csrfToken || '') : String(form?.get('csrfToken') || '');
    if (!(await verifyCsrf(csrfToken))) return fail('Invalid CSRF token.', 403);
    const answer = type.includes('application/json')
      ? String(payload?.answer || '').trim().slice(0, 5000)
      : String(form?.get('answer') || '').trim().slice(0, 5000);
    if (!answer) return fail('Answer is required.', 422);

    const existing = await prisma.question.findFirst({
      where: {
        id,
        ...(user.role === 'ADMIN' ? {} : { course: { instructorId: user.id } })
      },
      select: { id: true }
    });
    if (!existing) return fail('Question not found', 404);

    const question = await prisma.question.update({
      where: { id: existing.id },
      data: { answer },
      include: {
        user: { select: { name: true, email: true, locale: true } },
        course: { select: { title: true } }
      }
    });

    const appUrl = appUrlFromRequest(req);
    void dispatchEmail({
      to: question.user.email,
      templateKey: 'question-answered',
      variables: {
        studentName: question.user.name,
        instructorName: user.name || 'Instructor',
        questionTitle: question.title,
        answer,
        questionUrl: `${appUrl}/learn/${question.courseId}`
      },
      locale: question.user.locale
    });

    return NextResponse.redirect(new URL('/instructor/questions', req.url), 303);
  } catch (e: any) {
    return handleRouteError(e, req);
  }
}
