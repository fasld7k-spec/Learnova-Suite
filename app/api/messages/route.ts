import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail, handleError, handleRouteError, ok } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonArray, listHas, toList } from '@/lib/json-fields';

function wantsJson(req: NextRequest) {
  const accept = req.headers.get('accept') || '';
  const contentType = req.headers.get('content-type') || '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

export async function GET() {
  try {
    const user = await requireUser();
    const conversations = await prisma.conversation.findMany({
      where: { userIds: listHas(user.id) },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const participantIds = [...new Set(conversations.flatMap((conversation) => fromJsonArray<string>(conversation.userIds)))];
    const participants = participantIds.length
      ? await prisma.user.findMany({
          where: { id: { in: participantIds } },
          select: { id: true, name: true, email: true, role: true }
        })
      : [];
    const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
    const unread = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        senderId: { not: user.id },
        read: false,
        conversation: { userIds: listHas(user.id) }
      },
      _count: { _all: true }
    });
    const unreadByConversation = Object.fromEntries(unread.map((row) => [row.conversationId, row._count._all]));

    return ok({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        subject: conversation.subject,
        createdAt: conversation.createdAt,
        participants: fromJsonArray<string>(conversation.userIds)
          .filter((id) => id !== user.id)
          .map((id) => participantMap.get(id))
          .filter(Boolean),
        lastMessage: conversation.messages[0] || null,
        unreadCount: unreadByConversation[conversation.id] || 0
      }))
    });
  } catch (e: any) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const recipientId = String(f.get('recipientId') || '').trim();
    const subject = String(f.get('subject') || '').trim();
    const body = String(f.get('body') || '').trim();

    if (!recipientId) return fail('Recipient user ID is required.', 422);
    if (recipientId === user.id) return fail('Choose another recipient.', 422);
    if (!subject) return fail('Subject is required.', 422);
    if (!body) return fail('Message body is required.', 422);

    const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } });
    if (!recipient) return fail('Recipient not found.', 404);

    const conversation = await prisma.conversation.create({
      data: {
        subject,
        userIds: toList([user.id, recipientId]),
        messages: { create: { senderId: user.id, body } }
      }
    });

    await prisma.notification.create({
      data: { userId: recipientId, title: 'New message', body: subject }
    }).catch(() => null);

    if (wantsJson(req)) return ok({ conversationId: conversation.id });
    return NextResponse.redirect(new URL(`/messages/${conversation.id}`, req.url), 303);
  } catch (e: any) {
    return handleRouteError(e, req);
  }
}
