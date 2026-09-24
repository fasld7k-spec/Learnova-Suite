import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { isLessonDripUnlocked } from '@/lib/drip-access';
import { enrolledCourseForLesson } from '@/lib/enrollment';
import { prisma } from '@/lib/prisma';

function toNonNegativeInt(value: unknown, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, Math.floor(number)));
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const body = await req.json().catch(() => ({}));
    const csrfToken = req.headers.get('x-csrf-token') || String(body.csrfToken || '');
    if (!(await verifyCsrf(csrfToken))) return fail('Invalid CSRF token.', 403);

    const lessonId = String(body.lessonId || '').trim();
    const courseId = String(body.courseId || '').trim();
    if (!lessonId || !courseId) return fail('lessonId and courseId are required.', 422);

    const enrolledCourseId = await enrolledCourseForLesson(user.id, lessonId);
    if (!enrolledCourseId || enrolledCourseId !== courseId) return fail('Lesson not found', 404);
    if (!(await isLessonDripUnlocked({ userId: user.id, courseId, lessonId }))) return fail('Lesson is not unlocked yet.', 403);

    const watchSeconds = toNonNegativeInt(body.watchSeconds, 24 * 60 * 60);
    const lastPositionSeconds = toNonNegativeInt(body.lastPositionSeconds, 24 * 60 * 60);
    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      select: { watchSeconds: true, lastPositionSeconds: true }
    });

    const nextWatchSeconds = Math.max(existing?.watchSeconds || 0, watchSeconds);
    const nextLastPositionSeconds = Math.max(existing?.lastPositionSeconds || 0, lastPositionSeconds);
    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      update: {
        watchSeconds: nextWatchSeconds,
        lastPositionSeconds: nextLastPositionSeconds,
        lastWatchedAt: new Date(),
      },
      create: {
        userId: user.id,
        lessonId,
        watchSeconds: nextWatchSeconds,
        lastPositionSeconds: nextLastPositionSeconds,
        lastWatchedAt: new Date(),
      },
      select: { watchSeconds: true, lastPositionSeconds: true }
    });

    return ok(progress);
  } catch (error: any) {
    return fail(error?.message || 'Unable to record lesson watch progress', 500);
  }
}
