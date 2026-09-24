import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { enrolledCourseForLesson } from '@/lib/enrollment';
import { prisma } from '@/lib/prisma';
import { safeRedirectPath } from '@/lib/safe-redirect';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const lessonId = String(f.get('lessonId') || '');
    if (!lessonId || !(await enrolledCourseForLesson(user.id, lessonId))) return fail('Lesson not found', 404);
    await prisma.lessonBookmark.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      update: { note: String(f.get('note') || '') },
      create: { userId: user.id, lessonId, note: String(f.get('note') || '') }
    });
    return NextResponse.redirect(new URL(safeRedirectPath(String(f.get('redirect') || ''), '/student/bookmarks'), req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
