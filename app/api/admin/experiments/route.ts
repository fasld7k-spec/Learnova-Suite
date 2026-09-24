import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateExperimentCache } from '@/lib/experiments';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/experiments', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizeKey(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
}

function variantsFromForm(form: FormData) {
  const variants = ['variantA', 'variantB', 'variantC']
    .map((field, index) => ({ name: value(form, field), weight: index < 2 ? 50 : 0 }))
    .filter((variant) => variant.name);
  if (variants.length < 2) throw new Error('At least two variants are required.');
  return variants;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Experiment id is required.', 422);
      await prisma.experiment.delete({ where: { id } });
      invalidateExperimentCache();
      await audit({ actorId: admin.id, action: 'experiment.delete', entity: 'Experiment', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Experiment id is required.', 422);
      const current = await prisma.experiment.findUnique({ where: { id } });
      if (!current) return fail('Experiment not found.', 404);
      const next = await prisma.experiment.update({ where: { id }, data: { active: !current.active } });
      invalidateExperimentCache();
      await audit({
        actorId: admin.id,
        action: next.active ? 'experiment.enable' : 'experiment.disable',
        entity: 'Experiment',
        entityId: id,
        metadata: { key: next.key },
      });
      return redirect(req);
    }

    const key = normalizeKey(value(form, 'key'));
    if (!key) return fail('Experiment key is required.', 422);
    const variants = variantsFromForm(form);
    const data = { key, variants: toJson(variants), active: form.get('active') === 'on' };

    if (action === 'update') {
      if (!id) return fail('Experiment id is required.', 422);
      await prisma.experiment.update({ where: { id }, data });
      invalidateExperimentCache();
      await audit({ actorId: admin.id, action: 'experiment.update', entity: 'Experiment', entityId: id });
      return redirect(req);
    }

    const row = await prisma.experiment.upsert({ where: { key }, update: data, create: data });
    invalidateExperimentCache();
    await audit({ actorId: admin.id, action: 'experiment.upsert', entity: 'Experiment', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Experiment update failed.', 500);
  }
}
