import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/license-activations', req.url), 303);
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    const action = String(form.get('action') || 'create').trim().toLowerCase();

    if (action === 'create' || action === 'update') {
      const purchaseCode = String(form.get('purchaseCode') || '').trim();
      const domain = normalizeDomain(String(form.get('domain') || ''));
      const email = String(form.get('email') || '').trim() || null;
      const active = form.get('active') === 'on';

      if (!purchaseCode || purchaseCode.length < 6) return fail('Purchase code is required.', 422);
      if (!domain || domain.length > 255 || /[/?#\s]/.test(domain)) return fail('A valid domain is required.', 422);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Activation email is invalid.', 422);

      if (action === 'update') {
        if (!id) return fail('License activation id is required.', 422);
        await prisma.licenseActivation.update({ where: { id }, data: { purchaseCode, domain, email, active } });
        await audit({ actorId: admin.id, action: 'licenseActivation.update', entity: 'licenseActivation', entityId: id, metadata: { domain, email, active } });
        return redirect(req);
      }

      const activation = await prisma.licenseActivation.upsert({
        where: { purchaseCode },
        update: { domain, email, active },
        create: { purchaseCode, domain, email, active },
      });
      await audit({ actorId: admin.id, action: 'licenseActivation.create', entity: 'licenseActivation', entityId: activation.id, metadata: { domain, email, active } });
      return redirect(req);
    }

    if (!id) return fail('License activation id is required.', 422);
    if (!['toggle', 'delete'].includes(action)) return fail('Unsupported license activation action.', 422);

    const license = await prisma.licenseActivation.findUnique({ where: { id } });
    if (!license) return fail('License activation not found.', 404);

    if (action === 'delete') {
      await prisma.licenseActivation.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: 'licenseActivation.delete',
        entity: 'licenseActivation',
        entityId: id,
        metadata: { domain: license.domain, email: license.email },
      });
      return redirect(req);
    }

    const updated = await prisma.licenseActivation.update({ where: { id }, data: { active: !license.active } });
    await audit({
      actorId: admin.id,
      action: 'licenseActivation.toggle',
      entity: 'licenseActivation',
      entityId: id,
      metadata: { active: updated.active, domain: updated.domain },
    });

    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Unable to update license activation.', 500);
  }
}
