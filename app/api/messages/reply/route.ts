import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { fromJsonArray, listHas } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { fail, handleRouteError, ok } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';

function wantsJson(req: NextRequest) {
  const accept = req.headers.get('accept') || '';
  const contentType = req.headers.get('content-type') || '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

async function payload(req: NextRequest) {
  if (req.headers.get('content-type')?.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return {
      conversationId: String(body.conversationId || ''),
      body: String(body.body || ''),
      csrfToken: req.headers.get('x-csrf-token') || String(body.csrfToken || '')
    };
  }

  const form = await req.formData().catch(() => null);
  return {
    conversationId: String(form?.get('conversationId') || ''),
    body: String(form?.get('body') || ''),
    csrfToken: String(form?.get('csrfToken') || '')
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = await payload(req);
    if (!(await verifyCsrf(data.csrfToken))) return fail('Invalid CSRF token.', 403);
    const body = data.body.trim();
    if (!body) return fail('Message body is required.', 422);

    const conversation = await prisma.conversation.findFirst({
      where: { id: data.conversationId, userIds: listHas(user.id) }
    });
    if (!conversation) return fail('Conversation not found', 404);

    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: user.id, body }
    });

    const recipientIds = fromJsonArray<string>(conversation.userIds).filter((id) => id !== user.id);
    if (recipientIds.length) {
      await prisma.notification.createMany({
        data: recipientIds.map((recipientId) => ({
          userId: recipientId,
          title: `New message: ${conversation.subject}`,
          body: `${user.name}: ${body.slice(0, 140)}`
        }))
      }).catch(() => null);
    }

    if (wantsJson(req)) return ok({ message });
    return NextResponse.redirect(new URL(`/messages/${conversation.id}`, req.url), 303);
  } catch (e: any) {
    return handleRouteError(e, req);
  }
}
