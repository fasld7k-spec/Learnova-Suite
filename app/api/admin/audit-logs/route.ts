import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function redirect(req: NextRequest, count?: number) {
  const url = new URL('/admin/audit-logs', req.url);
  if (typeof count === 'number') url.searchParams.set('purged', String(count));
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();

    if (action !== 'purge-old') return fail('Unsupported audit log action.', 422);

    const days = Number(form.get('days') || 365);
    if (!Number.isFinite(days) || days < 30) return fail('Audit retention must be at least 30 days.', 422);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        NOT: { action: { in: ['audit_logs.purge_old', 'audit_logs.export'] } },
      },
    });

    await audit({
      actorId: admin.id,
      action: 'audit_logs.purge_old',
      entity: 'AuditLog',
      entityId: 'bulk',
      metadata: { count: result.count, retentionDays: days, cutoff: cutoff.toISOString() },
    });

    return redirect(req, result.count);
  } catch (error: any) {
    return fail(error.message || 'Audit log maintenance failed.', 500);
  }
}
