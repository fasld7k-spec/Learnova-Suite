import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();
    const conversationId = String(form.get('conversationId') || '').trim();
    if (!conversationId) return fail('Conversation ID is required.', 422);

    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, subject: true, userIds: true } });
    if (!conversation) return fail('Conversation not found.', 404);

    if (action === 'reply') {
      const body = String(form.get('body') || '').trim();
      if (!body) return fail('Reply body is required.', 422);

      const message = await prisma.message.create({
        data: { conversationId, senderId: admin.id, body },
      });

      const recipientIds = fromJsonArray<string>(conversation.userIds).filter((userId) => userId !== admin.id);
      if (recipientIds.length) {
        await prisma.notification.createMany({
          data: recipientIds.map((userId) => ({
            userId,
            title: `Admin reply: ${conversation.subject}`,
            body: body.slice(0, 180),
          })),
        }).catch(() => null);
      }

      await audit({
        actorId: admin.id,
        action: 'conversation.admin_reply',
        entity: 'conversation',
        entityId: conversationId,
        metadata: { messageId: message.id, notified: recipientIds.length },
      });

      return NextResponse.redirect(new URL('/admin/messages?replied=1', req.url), 303);
    }

    if (action === 'mark-read') {
      const result = await prisma.message.updateMany({ where: { conversationId, read: false }, data: { read: true } });
      await audit({ actorId: admin.id, action: 'conversation.mark_read', entity: 'conversation', entityId: conversationId, metadata: { updated: result.count } });
      return NextResponse.redirect(new URL('/admin/messages?saved=1', req.url), 303);
    }

    if (action === 'delete') {
      await prisma.conversation.delete({ where: { id: conversationId } });
      await audit({ actorId: admin.id, action: 'conversation.delete', entity: 'conversation', entityId: conversationId, metadata: { subject: conversation.subject } });
      return NextResponse.redirect(new URL('/admin/messages?deleted=1', req.url), 303);
    }

    return fail('Unsupported conversation action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Conversation action failed.', 500);
  }
}
