import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { fail, handleError, ok } from '@/lib/api';

async function csrfTokenFromRequest(req: NextRequest) {
  const headerToken = req.headers.get('x-csrf-token') || '';
  if (headerToken) return headerToken;
  const body = await req.json().catch(() => ({}));
  return typeof body.csrfToken === 'string' ? body.csrfToken : '';
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!(await verifyCsrf(await csrfTokenFromRequest(req)))) return fail('Invalid CSRF token.', 403);

    const result = await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });

    return ok({ updated: result.count });
  } catch (e) {
    return handleError(e);
  }
}
