import { NextRequest, NextResponse } from 'next/server';

import { audit } from '@/lib/audit';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function redirect(req: NextRequest, status = 'updated') {
  return NextResponse.redirect(new URL(`/admin/login-history?status=${encodeURIComponent(status)}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action');
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Login history id is required.', 422);
      const deleted = await prisma.loginHistory.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: 'login_history.delete',
        entity: 'LoginHistory',
        entityId: deleted.id,
        metadata: { email: deleted.email, success: deleted.success },
      });
      return redirect(req, 'deleted');
    }

    if (action === 'purge_failed') {
      const deleted = await prisma.loginHistory.deleteMany({ where: { success: false } });
      await audit({
        actorId: admin.id,
        action: 'login_history.purge_failed',
        entity: 'LoginHistory',
        metadata: { deleted: deleted.count },
      });
      return redirect(req, `purged-${deleted.count}`);
    }

    if (action === 'purge_old') {
      const days = Math.min(3650, Math.max(1, Number(form.get('days') || 90)));
      const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const deleted = await prisma.loginHistory.deleteMany({ where: { createdAt: { lt: before } } });
      await audit({
        actorId: admin.id,
        action: 'login_history.purge_old',
        entity: 'LoginHistory',
        metadata: { days, before: before.toISOString(), deleted: deleted.count },
      });
      return redirect(req, `purged-${deleted.count}`);
    }

    return fail('Unsupported login history action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Login history action failed.', 500);
  }
}
