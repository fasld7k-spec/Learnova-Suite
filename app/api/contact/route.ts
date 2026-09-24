import { NextRequest, NextResponse } from 'next/server';
import { dispatchAutomationEvent } from '@/lib/automation';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/api';
import { sendEmail } from '@/lib/email';
import { enforceRateLimit } from '@/lib/request-security';
import { getSiteSettings } from '@/lib/site-settings';

function wantsJson(req: NextRequest) {
  return req.headers.get('accept')?.includes('application/json');
}

function contactRedirect(req: NextRequest, status: string, ticketId?: string) {
  const url = new URL('/contact', req.url);
  url.searchParams.set('status', status);
  if (ticketId) url.searchParams.set('ticket', ticketId.slice(-8).toUpperCase());
  return NextResponse.redirect(url, 303);
}

function clean(value: FormDataEntryValue | null, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.contact', 5, 10 * 60_000);
  if (limited) return limited;

  const settings = await getSiteSettings();
  const f = await req.formData();
  const email = clean(f.get('email'), 180).toLowerCase();
  const name = clean(f.get('name'), 120);
  const subject = clean(f.get('subject') || 'Contact request', 180);
  const message = clean(f.get('message'), 3000);

  if (!email.includes('@') || !name || message.length < 5) {
    if (wantsJson(req)) return fail('Name, email, and message are required.', 422);
    return contactRedirect(req, 'invalid');
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      name,
      email,
      subject,
      message,
    },
  });

  await sendEmail({
    to: email,
    subject: `${settings.siteName} received your message`,
    html: `<h1>Message received</h1><p>Your ticket reference is ${ticket.id}.</p>`,
  }).catch(() => null);

  void dispatchAutomationEvent('ticket.opened', {
    ticketId: ticket.id,
    ticketEmail: email,
    ticketName: name,
    ticketSubject: ticket.subject,
  });

  if (wantsJson(req)) return ok({ message: 'Message received', ticketId: ticket.id });
  return contactRedirect(req, 'sent', ticket.id);
}
