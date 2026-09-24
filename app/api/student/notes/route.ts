import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { enrolledCourseForLesson, isEnrolled } from '@/lib/enrollment';
import { prisma } from '@/lib/prisma';

async function authorizedCourseForNote(userId: string, courseId: string, lessonId?: string | null) {
  if (lessonId) {
    const enrolledCourseId = await enrolledCourseForLesson(userId, lessonId);
    if (!enrolledCourseId || enrolledCourseId !== courseId) return null;
    return enrolledCourseId;
  }
  return (await isEnrolled(userId, courseId)) ? courseId : null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const courseId = req.nextUrl.searchParams.get('courseId') || undefined;
    return ok(await prisma.courseNote.findMany({ where: { userId: user.id, courseId }, orderBy: { updatedAt: 'desc' } }));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const body = await req.json().catch(() => null);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || body?.csrfToken || ''))) return fail('Invalid CSRF token.', 403);
    const courseId = String(body?.courseId || '');
    const lessonId = body?.lessonId ? String(body.lessonId) : null;
    const content = String(body?.content || '').trim().slice(0, 5000);
    if (!courseId || !(await authorizedCourseForNote(user.id, courseId, lessonId))) return fail('Course not found', 404);
    if (!content) return fail('Note content is required.', 422);
    return ok(await prisma.courseNote.create({ data: { userId: user.id, courseId, lessonId, content } }));
  } catch (e) {
    return handleError(e);
  }
}

async function ownedNote(userId: string, noteId: string) {
  if (!noteId) return null;
  return prisma.courseNote.findFirst({ where: { id: noteId, userId } });
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const body = await req.json().catch(() => null);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || body?.csrfToken || ''))) return fail('Invalid CSRF token.', 403);
    const id = String(body?.id || '');
    const content = String(body?.content || '').trim().slice(0, 5000);
    const note = await ownedNote(user.id, id);
    if (!note) return fail('Note not found', 404);
    if (!content) return fail('Note content is required.', 422);
    return ok(await prisma.courseNote.update({ where: { id: note.id }, data: { content } }));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const body = await req.json().catch(() => null);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || body?.csrfToken || ''))) return fail('Invalid CSRF token.', 403);
    const id = String(body?.id || '');
    const note = await ownedNote(user.id, id);
    if (!note) return fail('Note not found', 404);
    await prisma.courseNote.delete({ where: { id: note.id } });
    return ok({ id: note.id });
  } catch (e) {
    return handleError(e);
  }
}
