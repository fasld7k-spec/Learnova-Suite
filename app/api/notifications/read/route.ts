import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail, handleError, ok } from '@/lib/api';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { verifyCsrf } from '@/lib/csrf';

async function readPayload(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return {
      id: typeof body.id === 'string' ? body.id : undefined,
      all: body.all === true,
      redirectTo: undefined,
      csrfToken: req.headers.get('x-csrf-token') || String(body.csrfToken || '')
    };
  }

  const form = await req.formData().catch(() => null);
  return {
    id: String(form?.get('id') || '') || undefined,
    all: form?.get('all') === 'true',
    redirectTo: String(form?.get('redirectTo') || '') || undefined,
    csrfToken: String(form?.get('csrfToken') || '')
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const payload = await readPayload(req);
    if (!(await verifyCsrf(payload.csrfToken))) return fail('Invalid CSRF token.', 403);

    if (payload.all) {
      await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    } else if (payload.id) {
      await prisma.notification.updateMany({ where: { id: payload.id, userId: user.id }, data: { read: true } });
    } else {
      return fail('Notification id is required.', 422);
    }

    if (payload.redirectTo) {
      return NextResponse.redirect(new URL(safeRedirectPath(payload.redirectTo, '/notifications'), req.url), 303);
    }

    return ok({ read: true });
  } catch (e) {
    return handleError(e);
  }
}
