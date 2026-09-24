import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, handleError, ok } from '@/lib/api';
import { addonBooleanSetting, addonNumberSetting, getAddonRuntime } from '@/lib/addons';
import { requireApprovedInstructor, requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { validateStoredUrl } from '@/lib/url-validation';

function cleanDate(value: unknown) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) throw new Error('Valid start date is required.');
  return date;
}

function cleanDuration(value: unknown) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
    throw new Error('Duration must be between 1 and 1440 minutes.');
  }
  return Math.floor(duration);
}

async function assertCourseScope(courseId: string | null, user: { id: string; role: string }) {
  if (!courseId) return { courseId: null, instructorId: user.id };
  const course = await prisma.course.findFirst({
    where: user.role === 'ADMIN' ? { id: courseId } : { id: courseId, instructorId: user.id },
    select: { id: true, instructorId: true }
  });
  if (!course) throw new Error('COURSE_NOT_FOUND');
  return { courseId: course.id, instructorId: course.instructorId };
}

export async function GET() {
  const liveAddon = await getAddonRuntime('live-class-booking');
  if (!liveAddon.active) return ok([]);
  return ok(await prisma.liveSession.findMany({ where: { OR: [{ courseId: null }, { isPreview: true }] }, orderBy: { startsAt: 'asc' } }));
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUser(['INSTRUCTOR', 'ADMIN']);
    const user = sessionUser.role === 'INSTRUCTOR' ? await requireApprovedInstructor() : sessionUser;
    const liveAddon = await getAddonRuntime('live-class-booking');
    if (!liveAddon.active) return fail('Live class booking add-on is disabled.', 403);
    const allowFreePreview = addonBooleanSetting(liveAddon.settings, 'allowFreePreview', true);
    const defaultDuration = addonNumberSetting(liveAddon.settings, 'defaultSessionLength', 60);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return fail('Invalid live session request.', 422);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String((body as { csrfToken?: unknown }).csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const courseId = String(body.courseId || '') || null;
    const scopedCourse = await assertCourseScope(courseId, user);

    const title = String(body.title || '').trim();
    const url = validateStoredUrl(String(body.url || '').trim(), { label: 'Meeting link' });
    if (!title || !url) return fail('Title and meeting link are required.', 422);

    const item = await prisma.liveSession.create({
      data: {
        title,
        description: String(body.description || '').trim() || null,
        startsAt: cleanDate(body.startsAt),
        durationMinutes: cleanDuration(body.durationMinutes || defaultDuration),
        provider: String(body.provider || 'EXTERNAL').trim() || 'EXTERNAL',
        url,
        courseId: scopedCourse.courseId,
        instructorId: scopedCourse.instructorId,
        isPreview: allowFreePreview ? Boolean(body.isPreview) : false
      }
    });
    return ok(item, 201);
  } catch (e: any) {
    if (e?.message === 'COURSE_NOT_FOUND') return fail('Course not found', 404);
    return handleError(e);
  }
}
