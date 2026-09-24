import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

const allowedStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApprovedInstructor();
    const { id } = await params;
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const status = String(form.get('status') || '').trim().toUpperCase();
    const meetingUrl = String(form.get('meetingUrl') || '').trim();

    if (!allowedStatuses.has(status)) return fail('Unsupported booking status.', 422);
    const booking = await prisma.booking.findFirst({ where: { id, instructorId: user.id } });
    if (!booking) return fail('Booking not found', 404);
    if (booking.status === 'COMPLETED' && status !== 'COMPLETED') return fail('Completed bookings cannot be reopened from this action.', 422);
    const nextMeetingUrl = meetingUrl || booking.meetingUrl || '';
    if (status === 'APPROVED' && !nextMeetingUrl) return fail('Add a meeting URL before approving the booking.', 422);
    if ((status === 'APPROVED' || status === 'COMPLETED') && nextMeetingUrl && !/^https?:\/\//i.test(nextMeetingUrl)) return fail('Meeting URL must start with http:// or https://.', 422);

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status,
        meetingUrl: status === 'APPROVED' || status === 'COMPLETED' ? nextMeetingUrl : booking.meetingUrl,
      },
    });

    await prisma.notification.create({
      data: {
        userId: booking.studentId,
        title: `Booking ${status.toLowerCase()}`,
        body: status === 'APPROVED'
          ? `${user.name} approved your booking${updated.meetingUrl ? ' and added a meeting link.' : '.'}`
          : `${user.name} changed your booking status to ${status}.`,
      },
    }).catch(() => null);

    return NextResponse.redirect(new URL('/instructor/bookings?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Unable to update booking.', 500);
  }
}
