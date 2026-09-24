import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { getAddonRuntime } from '@/lib/addons';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { isEnrolled } from '@/lib/enrollment';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const liveAddon = await getAddonRuntime('live-class-booking');
    if (!liveAddon.active) return NextResponse.redirect(new URL('/student/live-sessions?error=disabled', req.url), 303);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const sessionId = String(form.get('sessionId') || '').trim();
    const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
    if (!session) return fail('Live session not found.', 404);
    if (session.courseId && !session.isPreview && !(await isEnrolled(user.id, session.courseId))) return fail('Live session not found.', 404);
    if (!session.url) return fail('This live session does not have a meeting URL yet.', 422);

    await prisma.liveSessionAttendance.upsert({
      where: { liveSessionId_userId: { liveSessionId: session.id, userId: user.id } },
      update: { joinedAt: new Date() },
      create: { liveSessionId: session.id, userId: user.id },
    });

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    return handleRouteError(error, req);
  }
}
