import { fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const title = String(form.get('title') || '').trim();
    const body = String(form.get('body') || '').trim();

    if (title.length < 4) return fail('Topic title must be at least 4 characters.', 422);
    if (body.length < 10) return fail('Topic body must be at least 10 characters.', 422);

    const topic = await prisma.discussionTopic.create({ data: { userId: user.id, title, body } });
    return NextResponse.redirect(new URL(`/community/${topic.id}`, req.url), 303);
  } catch (error) {
    return handleError(error);
  }
}
