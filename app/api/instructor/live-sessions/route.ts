import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { verifyCsrf } from '@/lib/csrf';
import { validateStoredUrl } from '@/lib/url-validation';
import { addonBooleanSetting, addonNumberSetting, dispatchAddonEvent, getAddonRuntime } from '@/lib/addons';
import { dispatchPlatformWebhook } from '@/lib/outbound-webhooks';
import { createLiveMeeting } from '@/lib/live-meeting-providers';
import { formFail } from '@/lib/form-response';

async function assertOwnedCourse(courseId: string | null, instructorId: string) {
  if (!courseId) return null;
  const course = await prisma.course.findFirst({ where: { id: courseId, instructorId }, select: { id: true } });
  if (!course) throw new Error('Course not found');
  return course.id;
}

async function normalizeSessionScope(data: ReturnType<typeof readSessionForm>, instructorId: string) {
  if (!data.lessonId) {
    await assertOwnedCourse(data.courseId, instructorId);
    return data;
  }

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: data.lessonId,
      type: 'LIVE',
      module: { course: { instructorId } }
    },
    select: { id: true, module: { select: { courseId: true } } }
  });
  if (!lesson) throw new Error('Live lesson not found');
  if (data.courseId && data.courseId !== lesson.module.courseId) throw new Error('Live lesson must belong to the selected course');
  return { ...data, courseId: lesson.module.courseId, lessonId: lesson.id };
}

function readSessionForm(f: FormData, options: { defaultDuration: number; allowFreePreview: boolean }) {
  const title = String(f.get('title') || '').trim();
  const startsAt = new Date(String(f.get('startsAt') || ''));
  const durationMinutes = Number(f.get('durationMinutes') || options.defaultDuration);
  const provider = String(f.get('provider') || 'EXTERNAL').toUpperCase();
  const rawUrl = String(f.get('url') || '').trim();
  const url = rawUrl ? validateStoredUrl(rawUrl, { label: 'Meeting link' }) : '';
  const courseId = String(f.get('courseId') || '') || null;
  const lessonId = String(f.get('lessonId') || '') || null;
  if (!title || Number.isNaN(startsAt.getTime()) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Title, date, and duration are required.');
  }
  if (provider === 'EXTERNAL' && !url) {
    throw new Error('Meeting link is required for external sessions.');
  }
  return {
    title,
    description: String(f.get('description') || '').trim() || null,
    startsAt,
    durationMinutes,
    provider,
    url,
    courseId,
    lessonId,
    isPreview: options.allowFreePreview ? f.get('isPreview') === 'on' : false
  };
}

async function withProviderMeeting(data: ReturnType<typeof readSessionForm>) {
  if (data.url) return data;
  const meeting = await createLiveMeeting(data);
  if (!meeting?.joinUrl) {
    throw new Error(`${data.provider} is not configured for automatic meeting creation. Add provider credentials in Admin > Integrations or paste a meeting link manually.`);
  }
  return { ...data, provider: meeting.provider, url: meeting.joinUrl };
}

export async function POST(req: NextRequest) {
  const redirectPath = '/instructor/live-sessions';
  try {
    const user = await requireApprovedInstructor();
    const liveAddon = await getAddonRuntime('live-class-booking');
    if (!liveAddon.active) return formFail(req, 'Live class booking add-on is disabled.', 403, redirectPath);
    const addonOptions = {
      defaultDuration: addonNumberSetting(liveAddon.settings, 'defaultSessionLength', 60),
      allowFreePreview: addonBooleanSetting(liveAddon.settings, 'allowFreePreview', true),
    };
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return formFail(req, 'Invalid CSRF token.', 403, redirectPath);
    const action = String(f.get('action') || 'create');

    if (action === 'delete') {
      const session = await prisma.liveSession.findFirst({ where: { id: String(f.get('sessionId') || ''), instructorId: user.id } });
      if (!session) return formFail(req, 'Live session not found', 404, redirectPath);
      await prisma.liveSession.delete({ where: { id: session.id } });
      const eventPayload = {
        sessionId: session.id,
        instructorId: user.id,
        courseId: session.courseId || '',
        lessonId: session.lessonId || '',
        title: session.title,
      };
      await Promise.allSettled([
        dispatchAddonEvent('live-session.deleted', eventPayload),
        dispatchPlatformWebhook('live-session.deleted', eventPayload),
      ]);
      await audit({ actorId: user.id, action: 'live_session.delete', entity: 'liveSession', entityId: session.id, metadata: eventPayload });
      return NextResponse.redirect(new URL('/instructor/live-sessions?saved=1', req.url), 303);
    }

    const data = await withProviderMeeting(await normalizeSessionScope(readSessionForm(f, addonOptions), user.id));

    if (action === 'update') {
      const session = await prisma.liveSession.findFirst({ where: { id: String(f.get('sessionId') || ''), instructorId: user.id } });
      if (!session) return formFail(req, 'Live session not found', 404, redirectPath);
      const updated = await prisma.liveSession.update({ where: { id: session.id }, data });
      const eventPayload = {
        sessionId: updated.id,
        instructorId: user.id,
        courseId: updated.courseId || '',
        lessonId: updated.lessonId || '',
        title: updated.title,
        startsAt: updated.startsAt.toISOString(),
        durationMinutes: updated.durationMinutes,
        isPreview: updated.isPreview,
      };
      await Promise.allSettled([
        dispatchAddonEvent('live-session.updated', eventPayload),
        dispatchPlatformWebhook('live-session.updated', eventPayload),
      ]);
      await audit({ actorId: user.id, action: 'live_session.update', entity: 'liveSession', entityId: updated.id, metadata: eventPayload });
      return NextResponse.redirect(new URL('/instructor/live-sessions?saved=1', req.url), 303);
    }

    const session = await prisma.liveSession.create({ data: { ...data, instructorId: user.id } });
    const eventPayload = {
      sessionId: session.id,
      instructorId: user.id,
      courseId: session.courseId || '',
      lessonId: session.lessonId || '',
      title: session.title,
      startsAt: session.startsAt.toISOString(),
      durationMinutes: session.durationMinutes,
      isPreview: session.isPreview,
    };
    await Promise.allSettled([
      dispatchAddonEvent('live-session.created', eventPayload),
      dispatchPlatformWebhook('live-session.created', eventPayload),
    ]);
    await audit({ actorId: user.id, action: 'live_session.create', entity: 'liveSession', entityId: session.id, metadata: eventPayload });
    return NextResponse.redirect(new URL('/instructor/live-sessions?saved=1', req.url), 303);
  } catch (e: any) {
    return formFail(req, e.message, ['Course not found', 'Live lesson not found'].includes(e.message) ? 404 : 422, redirectPath);
  }
}
