import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { safeRedirectPath } from '@/lib/safe-redirect';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireUser(['STUDENT', 'INSTRUCTOR', 'ADMIN']);
    const form = await req.formData().catch(() => null);
    if (!(await verifyCsrf(String(form?.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const redirect = form ? String(form.get('redirect') || '') : '';
    const question = await prisma.question.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
      select: { id: true, helpfulCount: true }
    });
    if (redirect) return NextResponse.redirect(new URL(safeRedirectPath(redirect, '/community'), req.url), 303);
    return ok({ questionId: question.id, helpful: true, helpfulCount: question.helpfulCount });
  } catch (e) {
    return handleError(e);
  }
}
