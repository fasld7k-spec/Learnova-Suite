import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';
import { normalizeRetentionCleanupLimit, runDataRetentionCleanup } from '@/lib/data-retention';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/data-retention', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizeEntity(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'cleanup') {
      const policyIds = form.getAll('policyId').map((policyId) => String(policyId).trim()).filter(Boolean);
      const requireSelection = value(form, 'requireSelection') === 'true';
      if (requireSelection && !policyIds.length) return fail('Select at least one active retention policy to clean up.', 422);
      const dryRun = value(form, 'mode') !== 'delete';
      const limit = normalizeRetentionCleanupLimit(value(form, 'limit'));
      const policies = await prisma.dataRetentionPolicy.findMany({
        where: {
          active: true,
          ...(policyIds.length ? { id: { in: policyIds } } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!policies.length) return fail('Select at least one active retention policy to clean up.', 422);

      const results = await runDataRetentionCleanup(prisma, policies, { dryRun, limit });
      const metadata = {
        dryRun,
        limit,
        policyIds: policies.map((policy) => policy.id),
        results,
        eligible: results.reduce((sum, result) => sum + result.eligible, 0),
        deleted: results.reduce((sum, result) => sum + result.deleted, 0),
      };
      await audit({
        actorId: admin.id,
        action: dryRun ? 'data_retention.cleanup_dry_run' : 'data_retention.cleanup',
        entity: 'DataRetentionPolicy',
        metadata: JSON.stringify(metadata),
      });
      return redirect(req);
    }

    if (action === 'delete') {
      if (!id) return fail('Retention policy id is required.', 422);
      await prisma.dataRetentionPolicy.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'data_retention.delete', entity: 'DataRetentionPolicy', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Retention policy id is required.', 422);
      const current = await prisma.dataRetentionPolicy.findUnique({ where: { id } });
      if (!current) return fail('Retention policy not found.', 404);
      await prisma.dataRetentionPolicy.update({ where: { id }, data: { active: !current.active } });
      return redirect(req);
    }

    const entity = normalizeEntity(value(form, 'entity'));
    const days = Number(value(form, 'days') || 365);
    const active = form.get('active') === 'on';
    if (entity.length < 2) return fail('Entity key is required.', 422);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return fail('Retention days must be between 1 and 3650.', 422);

    const data = { entity, days, active };
    if (action === 'update') {
      if (!id) return fail('Retention policy id is required.', 422);
      await prisma.dataRetentionPolicy.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'data_retention.update', entity: 'DataRetentionPolicy', entityId: id });
      return redirect(req);
    }

    const row = await prisma.dataRetentionPolicy.create({ data });
    await audit({ actorId: admin.id, action: 'data_retention.create', entity: 'DataRetentionPolicy', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Data retention update failed.', 500);
  }
}
