import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'INSTRUCTOR', 'ADMIN']);
    const body = await req.json().catch(() => null);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String(body?.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const courseId = String(body?.courseId || '').trim();
    const reason = String(body?.reason || '').trim().slice(0, 1000);

    if (!courseId) return fail('Course id is required.', 422);
    if (reason.length < 5) return fail('Report reason must be at least 5 characters.', 422);

    const course = await prisma.course.findFirst({ where: { id: courseId, status: 'PUBLISHED' }, select: { id: true } });
    if (!course) return fail('Course not found', 404);

    const report = await prisma.courseReport.create({ data: { userId: user.id, courseId: course.id, reason } });
    return ok(report);
  } catch (e) {
    return handleError(e);
  }
}
