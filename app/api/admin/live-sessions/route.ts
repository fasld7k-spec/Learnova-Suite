import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { dispatchAddonEvent, getAddonRuntime } from '@/lib/addons';
import { createLiveMeeting } from '@/lib/live-meeting-providers';
import { dispatchPlatformWebhook } from '@/lib/outbound-webhooks';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';

function field(form: FormData, key: string, fallback = '') {
  return String(form.get(key) || fallback).trim();
}

async function assertInstructor(instructorId: string) {
  const instructor = await prisma.user.findFirst({ where: { id: instructorId, role: 'INSTRUCTOR' }, select: { id: true } });
  if (!instructor) throw new Error('Instructor not found.');
  return instructor.id;
}

async function assertCourse(courseId: string, instructorId: string) {
  if (!courseId) return null;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, instructorId: true } });
  if (!course) throw new Error('Course not found.');
  if (course.instructorId !== instructorId) throw new Error('Selected course belongs to another instructor.');
  return course.id;
}

function readSessionData(form: FormData) {
  const title = field(form, 'title');
  const startsAt = new Date(field(form, 'startsAt'));
  const durationMinutes = Number(field(form, 'durationMinutes') || 60);
  if (title.length < 3) throw new Error('Session title must be at least 3 characters.');
  if (Number.isNaN(startsAt.getTime())) throw new Error('Session date is required.');
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) throw new Error('Duration must be at least 1 minute.');

  return {
    title,
    description: field(form, 'description') || null,
    startsAt,
    durationMinutes: Math.round(durationMinutes),
    provider: field(form, 'provider', 'EXTERNAL').toUpperCase(),
    url: field(form, 'url') ? validateStoredUrl(field(form, 'url'), { label: 'Meeting URL' }) : '',
    courseId: field(form, 'courseId') || null,
    instructorId: field(form, 'instructorId'),
    isPreview: form.get('isPreview') === 'on',
  };
}

async function withProviderMeeting(data: ReturnType<typeof readSessionData>) {
  if (data.url) return data;
  if (data.provider === 'EXTERNAL') throw new Error('Meeting URL is required for external sessions.');
  const meeting = await createLiveMeeting(data);
  if (!meeting?.joinUrl) {
    throw new Error(`${data.provider} is not configured for automatic meeting creation. Add provider credentials in Admin > Integrations or paste a meeting URL manually.`);
  }
  return { ...data, provider: meeting.provider, url: meeting.joinUrl };
}

function liveSessionPayload(session: {
  id: string;
  instructorId: string;
  courseId: string | null;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  isPreview: boolean;
  provider: string;
}) {
  return {
    sessionId: session.id,
    instructorId: session.instructorId,
    courseId: session.courseId || '',
    title: session.title,
    startsAt: session.startsAt.toISOString(),
    durationMinutes: session.durationMinutes,
    isPreview: session.isPreview,
    provider: session.provider,
  };
}

async function dispatchLiveSessionEvent(event: 'live-session.created' | 'live-session.updated' | 'live-session.deleted', payload: Record<string, unknown>) {
  await Promise.allSettled([
    dispatchAddonEvent(event, payload),
    dispatchPlatformWebhook(event, payload),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(field(form, 'csrfToken')))) return fail('Invalid CSRF token.', 403);
    const action = field(form, 'action', 'create');
    const liveAddon = await getAddonRuntime('live-class-booking');

    if (action === 'delete') {
      const sessionId = field(form, 'sessionId');
      if (!sessionId) return fail('Session ID is required.', 422);
      const session = await prisma.liveSession.delete({ where: { id: sessionId } });
      const eventPayload = liveSessionPayload(session);
      await dispatchLiveSessionEvent('live-session.deleted', eventPayload);
      await audit({ actorId: admin.id, action: 'live_session.delete', entity: 'liveSession', entityId: session.id, metadata: eventPayload });
      return NextResponse.redirect(new URL('/admin/live-sessions?deleted=1', req.url), 303);
    }

    if (!liveAddon.active) return fail('Live class booking add-on is disabled.', 403);

    if (action === 'toggle-preview') {
      const sessionId = field(form, 'sessionId');
      if (!sessionId) return fail('Session ID is required.', 422);
      const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
      if (!session) return fail('Live session not found.', 404);
      const updated = await prisma.liveSession.update({ where: { id: session.id }, data: { isPreview: !session.isPreview } });
      const eventPayload = liveSessionPayload(updated);
      await dispatchLiveSessionEvent('live-session.updated', eventPayload);
      await audit({ actorId: admin.id, action: 'live_session.preview.toggle', entity: 'liveSession', entityId: updated.id, metadata: eventPayload });
      return NextResponse.redirect(new URL('/admin/live-sessions?saved=1', req.url), 303);
    }

    if (action !== 'create' && action !== 'update') return fail('Unsupported live session action.', 422);

    const data = await withProviderMeeting(readSessionData(form));
    const instructorId = await assertInstructor(data.instructorId);
    const courseId = await assertCourse(data.courseId || '', instructorId);

    if (action === 'update') {
      const sessionId = field(form, 'sessionId');
      if (!sessionId) return fail('Session ID is required.', 422);
      const existing = await prisma.liveSession.findUnique({ where: { id: sessionId } });
      if (!existing) return fail('Live session not found.', 404);
      const session = await prisma.liveSession.update({ where: { id: existing.id }, data: { ...data, instructorId, courseId } });
      const eventPayload = liveSessionPayload(session);
      await dispatchLiveSessionEvent('live-session.updated', eventPayload);
      await audit({ actorId: admin.id, action: 'live_session.update', entity: 'liveSession', entityId: session.id, metadata: eventPayload });
      return NextResponse.redirect(new URL('/admin/live-sessions?saved=1', req.url), 303);
    }

    const session = await prisma.liveSession.create({ data: { ...data, instructorId, courseId } });
    const eventPayload = liveSessionPayload(session);
    await dispatchLiveSessionEvent('live-session.created', eventPayload);
    await audit({ actorId: admin.id, action: 'live_session.create', entity: 'liveSession', entityId: session.id, metadata: eventPayload });

    return NextResponse.redirect(new URL('/admin/live-sessions?created=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Live session action failed.', 500);
  }
}
