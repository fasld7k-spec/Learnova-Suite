import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { dispatchAutomationEvent } from '@/lib/automation';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

function clean(value: FormDataEntryValue | null, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.support', 5, 10 * 60_000);
  if (limited) return limited;

  const form = await req.formData();
  const email = clean(form.get('email'), 180).toLowerCase();
  const name = clean(form.get('name'), 120);
  const subject = clean(form.get('subject'), 180);
  const message = clean(form.get('message'), 3000);
  const category = clean(form.get('category') || 'General', 60);
  const priority = clean(form.get('priority') || 'Normal', 40);

  if (!email.includes('@') || !name || subject.length < 3 || message.length < 10) {
    return fail('Name, email, subject, and message are required.', 422);
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      name,
      email,
      subject: `[${category} / ${priority}] ${subject}`,
      message
    }
  });

  await sendEmail({
    to: email,
    subject: 'We received your support ticket',
    html: `Ticket #${ticket.id}`
  });

  void dispatchAutomationEvent('ticket.opened', {
    ticketId: ticket.id,
    ticketEmail: email,
    ticketName: name,
    ticketSubject: ticket.subject,
    ticketCategory: category,
    ticketPriority: priority,
  });

  return NextResponse.redirect(new URL(`/support?ticket=${ticket.id}`, req.url), 303);
}
