import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { generateSignedEmbedUrl } from '@/lib/video-providers';
import { prisma } from '@/lib/prisma';
import { isLessonDripUnlocked } from '@/lib/drip-access';

/**
 * POST /api/media/sign
 *
 * Authenticated endpoint. Accepts { lessonId } or { videoAssetId } in the request body.
 * Verifies the authenticated user can access the owning course, then returns a
 * signed Bunny.net embed URL that expires after 3600 seconds.
 *
 * Returns:
 *   200 { signedUrl }  — enrolled user
 *   403                — user is not enrolled in the course
 *   401                — unauthenticated
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const body = await req.json().catch(() => ({}));
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String(body.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const lessonId = String(body.lessonId || '');
    const videoAssetId = String(body.videoAssetId || '');

    if (!lessonId && !videoAssetId) {
      return fail('lessonId or videoAssetId is required', 400);
    }

    const videoAsset = await prisma.videoAsset.findFirst({
      where: {
        ...(videoAssetId ? { id: videoAssetId } : {}),
        ...(lessonId ? { lessonId } : {})
      },
      include: {
        lesson: {
          select: {
            isPreview: true,
            module: { select: { courseId: true, course: { select: { instructorId: true } } } }
          }
        }
      }
    });

    if (!videoAsset) return fail('Video asset not found', 404);

    const courseId = videoAsset.lesson.module.courseId;
    const allowed = user.role === 'ADMIN'
      || videoAsset.lesson.module.course.instructorId === user.id
      || videoAsset.lesson.isPreview
      // Enrolled learners only once the lesson's drip schedule has unlocked it.
      || await isLessonDripUnlocked({ userId: user.id, courseId, lessonId: videoAsset.lessonId });

    if (!allowed) {
      return fail('Forbidden', 403);
    }

    // Generate a signed embed URL expiring after 3600 seconds
    const signedUrl = generateSignedEmbedUrl(videoAsset.externalId, 3600);

    return ok({ signedUrl, courseId, lessonId: videoAsset.lessonId });
  } catch (e) {
    return handleError(e);
  }
}
