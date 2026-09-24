import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanTime(value: FormDataEntryValue | null, label: string) {
  const time = String(value || '').trim();
  if (!timePattern.test(time)) throw new Error(`${label} must use HH:MM format.`);
  return time;
}

function cleanWeekday(value: FormDataEntryValue | null) {
  const weekday = Number(value);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('Weekday is invalid.');
  return weekday;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create');
    const id = String(form.get('id') || '');

    if (action === 'delete') {
      await prisma.instructorAvailability.deleteMany({ where: { id, instructorId: user.id } });
      await audit({ actorId: user.id, action: 'instructor.availability.delete', entity: 'instructorAvailability', entityId: id });
      return NextResponse.redirect(new URL('/instructor/availability', req.url), 303);
    }

    const data = {
      weekday: cleanWeekday(form.get('weekday')),
      startsAt: cleanTime(form.get('startsAt'), 'Start time'),
      endsAt: cleanTime(form.get('endsAt'), 'End time'),
      timezone: String(form.get('timezone') || 'Africa/Cairo').trim() || 'Africa/Cairo',
      active: form.get('active') === 'on' || action === 'create',
    };

    if (data.startsAt >= data.endsAt) return fail('End time must be after start time.', 422);

    if (action === 'update') {
      const updated = await prisma.instructorAvailability.updateMany({
        where: { id, instructorId: user.id },
        data,
      });
      if (!updated.count) return fail('Availability slot not found.', 404);
      await audit({ actorId: user.id, action: 'instructor.availability.update', entity: 'instructorAvailability', entityId: id, metadata: data });
    } else {
      const slot = await prisma.instructorAvailability.create({ data: { instructorId: user.id, ...data } });
      await audit({ actorId: user.id, action: 'instructor.availability.create', entity: 'instructorAvailability', entityId: slot.id, metadata: data });
    }

    return NextResponse.redirect(new URL('/instructor/availability', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
