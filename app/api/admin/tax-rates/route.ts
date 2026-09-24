import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/tax-rates', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function parsePercent(form: FormData) {
  const percent = Number(value(form, 'percent') || 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Tax percent must be between 0 and 100.');
  return percent;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Tax rate id is required.', 422);
      await prisma.taxRate.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'tax_rate.delete', entity: 'TaxRate', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Tax rate id is required.', 422);
      const current = await prisma.taxRate.findUnique({ where: { id } });
      if (!current) return fail('Tax rate not found.', 404);
      await prisma.taxRate.update({ where: { id }, data: { active: !current.active } });
      return redirect(req);
    }

    const name = value(form, 'name');
    const country = value(form, 'country').toUpperCase();
    const percent = parsePercent(form);
    const active = form.get('active') === 'on';
    if (name.length < 2) return fail('Tax rule name is required.', 422);
    if (!/^[A-Z]{2,3}$/.test(country)) return fail('Country must be a 2-3 letter code.', 422);

    const data = { name, country, percent, active };
    if (action === 'update') {
      if (!id) return fail('Tax rate id is required.', 422);
      await prisma.taxRate.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'tax_rate.update', entity: 'TaxRate', entityId: id });
      return redirect(req);
    }

    const row = await prisma.taxRate.create({ data });
    await audit({ actorId: admin.id, action: 'tax_rate.create', entity: 'TaxRate', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Tax rate update failed.', 500);
  }
}
