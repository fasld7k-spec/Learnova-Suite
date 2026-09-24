import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { formFail } from '@/lib/form-response';

const allowedDurations = new Set([15, 30, 45, 60, 90, 120]);

function timeOfDay(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function validateBookingSlot(instructorId: string, startsAt: Date, durationMin: number, excludeId?: string) {
  const instructor = await prisma.user.findFirst({ where: { id: instructorId, role: 'INSTRUCTOR', status: 'APPROVED' } });
  if (!instructor) return 'Instructor is not available for booking.';
  if (startsAt.getTime() <= Date.now()) return 'Booking time must be in the future.';
  if (!allowedDurations.has(durationMin)) return 'Choose a supported duration: 15, 30, 45, 60, 90, or 120 minutes.';

  const end = new Date(startsAt.getTime() + durationMin * 60 * 1000);
  const day = startsAt.getDay();
  const startTime = timeOfDay(startsAt);
  const endTime = timeOfDay(end);
  const availability = await prisma.instructorAvailability.findFirst({
    where: {
      instructorId,
      weekday: day,
      active: true,
      startsAt: { lte: startTime },
      endsAt: { gte: endTime },
    },
  });
  if (!availability) return 'Selected time is outside the instructor availability.';

  const candidates = await prisma.booking.findMany({
    where: {
      instructorId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ['PENDING', 'APPROVED'] },
      startsAt: { lt: end },
    },
    select: { startsAt: true, durationMin: true },
  });
  const hasOverlap = candidates.some((booking) => new Date(booking.startsAt.getTime() + booking.durationMin * 60 * 1000) > startsAt);
  if (hasOverlap) return 'Selected time conflicts with another booking.';

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formFail(req, 'Invalid CSRF token.', 403, '/student/bookings');

    const action = String(form.get('_action') || 'create').trim();
    const bookingId = String(form.get('bookingId') || '').trim();

    if (action === 'cancel') {
      if (!bookingId) return formFail(req, 'Booking ID is required.', 422, '/student/bookings');
      const booking = await prisma.booking.findFirst({ where: { id: bookingId, studentId: user.id } });
      if (!booking) return formFail(req, 'Booking not found.', 404, '/student/bookings');
      if (!['PENDING', 'APPROVED'].includes(booking.status)) return formFail(req, 'Only pending or approved bookings can be cancelled.', 422, '/student/bookings');
      await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      await prisma.notification.create({ data: { userId: booking.instructorId, title: 'Booking cancelled', body: `${user.name} cancelled a booking request.` } }).catch(() => null);
      return NextResponse.redirect(new URL('/student/bookings?cancelled=1', req.url), 303);
    }

    const instructorId = String(form.get('instructorId') || '');
    const startsAtValue = String(form.get('startsAt') || '');
    const durationMin = Number(form.get('durationMin') || 30);
    const startsAt = new Date(startsAtValue);

    if (!instructorId) return formFail(req, 'Instructor is required', 400, '/student/bookings');
    if (!startsAtValue || Number.isNaN(startsAt.getTime())) return formFail(req, 'Valid start time is required', 400, '/student/bookings');
    if (!Number.isFinite(durationMin) || durationMin < 15) return formFail(req, 'Duration must be at least 15 minutes', 400, '/student/bookings');

    if (action === 'reschedule') {
      if (!bookingId) return formFail(req, 'Booking ID is required.', 422, '/student/bookings');
      const booking = await prisma.booking.findFirst({ where: { id: bookingId, studentId: user.id } });
      if (!booking) return formFail(req, 'Booking not found.', 404, '/student/bookings');
      if (!['PENDING', 'APPROVED'].includes(booking.status)) return formFail(req, 'Only pending or approved bookings can be rescheduled.', 422, '/student/bookings');
      const slotError = await validateBookingSlot(booking.instructorId, startsAt, durationMin, booking.id);
      if (slotError) return formFail(req, slotError, 422, '/student/bookings');
      await prisma.booking.update({ where: { id: booking.id }, data: { startsAt, durationMin, status: 'PENDING', notes: String(form.get('notes') || booking.notes || '') } });
      await prisma.notification.create({ data: { userId: booking.instructorId, title: 'Booking rescheduled', body: `${user.name} requested a new booking time.` } }).catch(() => null);
      return NextResponse.redirect(new URL('/student/bookings?rescheduled=1', req.url), 303);
    }

    const slotError = await validateBookingSlot(instructorId, startsAt, durationMin);
    if (slotError) return formFail(req, slotError, 422, '/student/bookings');

    const booking = await prisma.booking.create({
      data: {
        studentId: user.id,
        instructorId,
        startsAt,
        durationMin,
        notes: String(form.get('notes') || '')
      }
    });
    await prisma.notification.create({ data: { userId: booking.instructorId, title: 'New booking request', body: `Booking request from ${user.name}` } }).catch(() => null);
    return NextResponse.redirect(new URL('/student/bookings?requested=1', req.url), 303);
  } catch (error: any) {
    return formFail(req, error.message, 500, '/student/bookings');
  }
}
