import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['OPEN', 'ANSWERED', 'CLOSED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/support', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'status';
    const ticketId = value(form, 'ticketId');
    if (!ticketId) return fail('Ticket ID is required.', 422);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return fail('Ticket not found.', 404);

    if (action === 'delete') {
      await prisma.$transaction([
        prisma.supportReply.deleteMany({ where: { ticketId } }),
        prisma.supportTicket.delete({ where: { id: ticketId } }),
      ]);
      await audit({ actorId: admin.id, action: 'support.ticket.delete', entity: 'supportTicket', entityId: ticketId, metadata: { subject: ticket.subject, email: ticket.email } });
      return redirect(req);
    }

    if (action === 'tag') {
      const tagName = value(form, 'tag').toLowerCase();
      if (!tagName) return fail('Support tag is required.', 422);
      const tag = await prisma.supportTag.findUnique({ where: { name: tagName } });
      if (!tag) return fail('Support tag not found.', 404);
      const cleanSubject = ticket.subject.replace(/^\[tag:[^\]]+\]\s*/i, '');
      const updated = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { subject: `[tag:${tag.name}] ${cleanSubject}` },
      });
      await audit({
        actorId: admin.id,
        action: 'support.ticket.tag',
        entity: 'supportTicket',
        entityId: ticketId,
        metadata: { tag: tag.name, subject: updated.subject },
      });
      return redirect(req);
    }

    const status = value(form, 'status').toUpperCase();
    if (!statuses.has(status)) return fail('Unsupported support ticket status.', 422);
    const updated = await prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
    await audit({
      actorId: admin.id,
      action: 'support.ticket.status',
      entity: 'supportTicket',
      entityId: ticketId,
      metadata: { from: ticket.status, to: updated.status, subject: ticket.subject, email: ticket.email },
    });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Support ticket action failed.', 500);
  }
}
