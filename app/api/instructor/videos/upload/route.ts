import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { formFail, wantsJson } from '@/lib/form-response';
import { prisma } from '@/lib/prisma';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { uploadToBunny, getBunnyVideoConfig } from '@/lib/video-providers';
import { verifyCsrf } from '@/lib/csrf';

const allowedVideoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const maxVideoUploadBytes = 1024 * 1024 * 500;

export async function POST(req: NextRequest) {
  let redirectTo = '/instructor/courses';

  try {
    const user = await requireUser(['INSTRUCTOR', 'ADMIN']);
    if (user.role === 'INSTRUCTOR' && user.status !== 'APPROVED') return formFail(req, 'Forbidden', 403, redirectTo);

    const formData = await req.formData();
    redirectTo = safeRedirectPath(formData.get('redirect'), redirectTo);
    if (!(await verifyCsrf(String(formData.get('csrfToken') || '')))) {
      return formFail(req, 'Invalid CSRF token', 403, redirectTo);
    }

    const file = formData.get('file') as File | null;
    const lessonId = String(formData.get('lessonId') || '').trim();

    if (!file) return formFail(req, 'No file provided', 400, redirectTo);
    if (!allowedVideoTypes.has(file.type)) return formFail(req, 'Unsupported video type', 422, redirectTo);
    if (file.size > maxVideoUploadBytes) return formFail(req, 'Video file too large', 422, redirectTo);
    if (!lessonId) return formFail(req, 'lessonId is required', 400, redirectTo);

    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        ...(user.role === 'ADMIN' ? {} : { module: { course: { instructorId: user.id } } }),
      },
      select: { id: true },
    });
    if (!lesson) return formFail(req, 'Lesson not found', 404, redirectTo);

    const videoId = await uploadToBunny(file, file.name);
    const { embedUrl } = getBunnyVideoConfig(videoId);

    const videoAsset = await prisma.videoAsset.upsert({
      where: { lessonId: lesson.id },
      update: {
        provider: 'bunny',
        externalId: videoId,
        embedUrl,
        hlsUrl: null,
        duration: null,
        status: 'PROCESSING',
      },
      create: {
        lessonId: lesson.id,
        provider: 'bunny',
        externalId: videoId,
        embedUrl,
        status: 'PROCESSING',
      },
    });
    await prisma.lesson.update({ where: { id: lesson.id }, data: { type: 'VIDEO', videoUrl: embedUrl } });

    if (!wantsJson(req)) return NextResponse.redirect(new URL(redirectTo, req.url), 303);
    return NextResponse.json({ videoId, videoAssetId: videoAsset.id, embedUrl, status: videoAsset.status }, { status: 200 });
  } catch (e: any) {
    const message = e?.message || 'Upload failed';
    if (message === 'UNAUTHENTICATED') return formFail(req, 'Unauthenticated', 401, redirectTo);
    if (message === 'FORBIDDEN') return formFail(req, 'Forbidden', 403, redirectTo);
    return formFail(req, process.env.NODE_ENV === 'production' ? 'Upload failed' : `Upload failed: ${message}`, 500, redirectTo);
  }
}
