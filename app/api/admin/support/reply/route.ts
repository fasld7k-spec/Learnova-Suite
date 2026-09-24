import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const ticketId = String(form.get('ticketId') || '').trim();
    const body = String(form.get('body') || '').trim();

    if (!ticketId) return fail('Ticket ID is required.', 422);
    if (body.length < 5) return fail('Reply body must be at least 5 characters.', 422);
    if (body.length > 8000) return fail('Reply body must be 8,000 characters or fewer.', 422);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return fail('Ticket not found.', 404);

    const reply = await prisma.supportReply.create({ data: { ticketId: ticket.id, adminId: admin.id, body } });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'ANSWERED' } });
    const emailResult = await sendEmail({ to: ticket.email, subject: `Re: ${ticket.subject}`, html: escapeHtml(body).replace(/\n/g, '<br />') });
    await audit({
      actorId: admin.id,
      action: 'support.reply.create',
      entity: 'supportReply',
      entityId: reply.id,
      metadata: { ticketId: ticket.id, emailSentTo: ticket.email, emailStatus: emailResult.status, emailProvider: emailResult.provider },
    });

    return NextResponse.redirect(new URL(`/admin/support?replied=${emailResult.status.toLowerCase()}`, req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Support reply could not be sent.', 500);
  }
}
