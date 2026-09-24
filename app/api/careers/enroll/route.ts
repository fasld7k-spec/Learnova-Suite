import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/student/career-tracks', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData().catch(() => null);
    if (!form) return formError(req, 'Invalid enrollment request.');
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const careerTrackId = String(form.get('careerTrackId') || '').trim();

    if (!careerTrackId) return formError(req, 'Choose a career track before enrolling.');
    const track = await prisma.careerTrack.findFirst({ where: { id: careerTrackId, active: true }, select: { id: true } });
    if (!track) return formError(req, 'This career track is no longer available.', 404);

    await prisma.careerTrackEnrollment.upsert({
      where: { careerTrackId_userId: { careerTrackId, userId: user.id } },
      update: {},
      create: { careerTrackId, userId: user.id },
    });
    return NextResponse.redirect(new URL('/student/career-tracks', req.url), 303);
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED' || e?.message === 'FORBIDDEN') return handleRouteError(e, req);
    return formError(req, e?.message || 'Unable to enroll in this career track.', 500);
  }
}
