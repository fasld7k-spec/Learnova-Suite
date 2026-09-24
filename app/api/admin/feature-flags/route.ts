import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateFeatureFlagCache } from '@/lib/features';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/feature-flags', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizeKey(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Feature flag id is required.', 422);
      await prisma.featureFlag.delete({ where: { id } });
      invalidateFeatureFlagCache();
      await audit({ actorId: admin.id, action: 'feature_flag.delete', entity: 'FeatureFlag', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Feature flag id is required.', 422);
      const current = await prisma.featureFlag.findUnique({ where: { id } });
      if (!current) return fail('Feature flag not found.', 404);
      const next = await prisma.featureFlag.update({ where: { id }, data: { enabled: !current.enabled } });
      invalidateFeatureFlagCache();
      await audit({
        actorId: admin.id,
        action: next.enabled ? 'feature_flag.enable' : 'feature_flag.disable',
        entity: 'FeatureFlag',
        entityId: id,
        metadata: { key: next.key },
      });
      return redirect(req);
    }

    const key = normalizeKey(value(form, 'key'));
    const description = value(form, 'description') || null;
    const enabled = form.get('enabled') === 'on';
    if (key.length < 2) return fail('Feature flag key is required.', 422);

    const data = { key, description, enabled };
    if (action === 'update') {
      if (!id) return fail('Feature flag id is required.', 422);
      await prisma.featureFlag.update({ where: { id }, data });
      invalidateFeatureFlagCache();
      await audit({ actorId: admin.id, action: 'feature_flag.update', entity: 'FeatureFlag', entityId: id });
      return redirect(req);
    }

    const row = await prisma.featureFlag.upsert({ where: { key }, update: data, create: data });
    invalidateFeatureFlagCache();
    await audit({ actorId: admin.id, action: 'feature_flag.upsert', entity: 'FeatureFlag', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Feature flag update failed.', 500);
  }
}
