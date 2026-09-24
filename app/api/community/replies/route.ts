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
    const topicId = String(form.get('topicId') || '').trim();
    const body = String(form.get('body') || '').trim();

    if (!topicId) return fail('Topic is required.', 422);
    if (body.length < 4) return fail('Reply must be at least 4 characters.', 422);

    const topic = await prisma.discussionTopic.findUnique({ where: { id: topicId }, select: { id: true, locked: true } });
    if (!topic) return fail('Topic not found.', 404);
    if (topic.locked) return fail('Topic is locked.', 403);

    await prisma.discussionReply.create({ data: { topicId, userId: user.id, body } });
    return NextResponse.redirect(new URL(`/community/${topicId}`, req.url), 303);
  } catch (error) {
    return handleError(error);
  }
}
