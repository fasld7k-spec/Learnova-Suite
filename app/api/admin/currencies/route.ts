import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/currencies', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Currency id is required.', 422);
      const current = await prisma.currency.findUnique({ where: { id } });
      if (!current) return fail('Currency not found.', 404);
      if (current.code === 'USD') return fail('The USD base currency cannot be deleted. Disable it only if you have another base workflow.', 409);
      await prisma.currency.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'currency.delete', entity: 'Currency', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Currency id is required.', 422);
      const current = await prisma.currency.findUnique({ where: { id } });
      if (!current) return fail('Currency not found.', 404);
      const currency = await prisma.currency.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: currency.active ? 'currency.enable' : 'currency.disable', entity: 'Currency', entityId: id, metadata: { code: currency.code } });
      return redirect(req);
    }

    const code = value(form, 'code').toUpperCase();
    const symbol = value(form, 'symbol');
    const exchangeRate = Number(value(form, 'exchangeRate') || 1);
    const active = form.get('active') === 'on';
    if (!/^[A-Z]{3}$/.test(code)) return fail('Currency code must be a 3-letter ISO code.', 422);
    if (!symbol) return fail('Currency symbol is required.', 422);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return fail('Exchange rate must be greater than zero.', 422);

    const data = { code, symbol, exchangeRate, active };
    if (action === 'update') {
      if (!id) return fail('Currency id is required.', 422);
      await prisma.currency.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'currency.update', entity: 'Currency', entityId: id });
      return redirect(req);
    }

    const row = await prisma.currency.upsert({ where: { code }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'currency.upsert', entity: 'Currency', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Currency update failed.', 500);
  }
}
