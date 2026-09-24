import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { isEnrolled } from '@/lib/enrollment';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

const allowedStatuses = new Set(['IN_PROGRESS', 'COMPLETED', 'PASSED', 'FAILED']);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const body = await req.json().catch(() => ({}));
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String(body.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const packageId = String(body.packageId || '');
    const status = String(body.status || 'IN_PROGRESS').toUpperCase();
    const score = body.score === null || body.score === undefined || body.score === '' ? null : Number(body.score);
    if (!packageId) return fail('packageId is required', 422);
    if (!allowedStatuses.has(status)) return fail('Invalid SCORM status.', 422);
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) return fail('Score must be an integer from 0 to 100.', 422);

    const pkg = await prisma.scormPackage.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.active || !(await isEnrolled(user.id, pkg.courseId))) return fail('Package not found', 404);

    const attempt = await prisma.scormAttempt.create({
      data: {
        packageId: pkg.id,
        userId: user.id,
        score,
        status,
        runtimeData: toJson(body.runtimeData && typeof body.runtimeData === 'object' ? body.runtimeData : {}),
      },
    });
    return ok(attempt);
  } catch (error) {
    return handleError(error);
  }
}
