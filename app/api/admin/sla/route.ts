import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/sla', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function positiveInt(raw: string, label: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive number.`);
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('SLA policy id is required.', 422);
      await prisma.slaPolicy.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'sla.delete', entity: 'SlaPolicy', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('SLA policy id is required.', 422);
      const current = await prisma.slaPolicy.findUnique({ where: { id } });
      if (!current) return fail('SLA policy not found.', 404);
      const updated = await prisma.slaPolicy.update({ where: { id }, data: { active: !current.active } });
      await audit({
        actorId: admin.id,
        action: updated.active ? 'sla.enable' : 'sla.disable',
        entity: 'SlaPolicy',
        entityId: id,
        metadata: { name: updated.name },
      });
      return redirect(req);
    }

    const name = value(form, 'name');
    const responseHrs = positiveInt(value(form, 'responseHrs') || '24', 'Response hours');
    const resolveHrs = positiveInt(value(form, 'resolveHrs') || '72', 'Resolve hours');
    const active = form.get('active') === 'on';
    if (name.length < 2) return fail('SLA policy name is required.', 422);
    if (resolveHrs < responseHrs) return fail('Resolve hours must be greater than or equal to response hours.', 422);

    const data = { name, responseHrs, resolveHrs, active };
    if (action === 'update') {
      if (!id) return fail('SLA policy id is required.', 422);
      await prisma.slaPolicy.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'sla.update', entity: 'SlaPolicy', entityId: id });
      return redirect(req);
    }

    const row = await prisma.slaPolicy.create({ data });
    await audit({ actorId: admin.id, action: 'sla.create', entity: 'SlaPolicy', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'SLA policy update failed.', 500);
  }
}
