import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { courseScopeToJson } from '@/lib/coupons';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/coupons', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function parseDate(value: string, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid.`);
  return date;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(f, '_action') || 'save';
    const id = value(f, 'id');

    if (action === 'delete') {
      if (!id) return fail('Coupon id is required.', 422);
      const redemptionCount = await prisma.couponRedemption.count({ where: { couponId: id } });
      if (redemptionCount > 0) return fail('Coupons with redemption history cannot be deleted. Disable the coupon instead.', 409);
      const coupon = await prisma.coupon.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'coupon.delete', entity: 'Coupon', entityId: coupon.id, metadata: { code: coupon.code } });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Coupon id is required.', 422);
      const current = await prisma.coupon.findUnique({ where: { id } });
      if (!current) return fail('Coupon not found.', 404);
      const coupon = await prisma.coupon.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: coupon.active ? 'coupon.enable' : 'coupon.disable', entity: 'Coupon', entityId: coupon.id, metadata: { code: coupon.code } });
      return redirect(req);
    }

    const code = value(f, 'code').toUpperCase();
    const discountType = value(f, 'discountType').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT';
    const percent = Number(f.get('percent') || 0);
    const amount = Number(f.get('amount') || 0);
    const starts = value(f, 'startsAt');
    const expires = value(f, 'expiresAt');
    const maxUses = Number(f.get('maxUses') || 0);
    const perUserLimit = Number(f.get('perUserLimit') || 0);
    const minOrderAmount = Number(f.get('minOrderAmount') || 0);
    const courseIds = courseScopeToJson(f.getAll('courseIds'));

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return fail('Coupon code must be 3-40 characters using letters, numbers, underscore, or dash.', 422);
    if (discountType === 'PERCENT' && (!Number.isInteger(percent) || percent < 1 || percent > 100)) {
      return fail('Percent must be between 1 and 100', 422);
    }
    if (discountType === 'FIXED' && (!Number.isFinite(amount) || amount <= 0)) return fail('Fixed amount must be greater than zero', 422);
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) return fail('Minimum order amount cannot be negative', 422);
    if (!Number.isInteger(maxUses) || maxUses < 0) return fail('Max uses must be zero or greater.', 422);
    if (!Number.isInteger(perUserLimit) || perUserLimit < 0) return fail('Per-user limit must be zero or greater.', 422);
    const startsAt = parseDate(starts, 'Start date');
    const expiresAt = parseDate(expires, 'Expiration date');
    if (startsAt && expiresAt && startsAt > expiresAt) return fail('Coupon start date must be before expiration date.', 422);

    const data = {
      percent: discountType === 'PERCENT' ? percent : 0,
      discountType,
      amount: discountType === 'FIXED' ? amount : 0,
      active: f.get('active') === 'on',
      startsAt,
      expiresAt,
      maxUses: maxUses > 0 ? maxUses : null,
      perUserLimit: perUserLimit > 0 ? perUserLimit : null,
      minOrderAmount,
      courseIds,
    };

    let coupon;
    if (action === 'update') {
      if (!id) return fail('Coupon id is required.', 422);
      coupon = await prisma.coupon.update({ where: { id }, data: { code, ...data } });
      await audit({ actorId: admin.id, action: 'coupon.update', entity: 'Coupon', entityId: coupon.id, metadata: { code, discountType } });
      return redirect(req);
    }

    coupon = await prisma.coupon.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    });
    await audit({ actorId: admin.id, action: 'coupon.save', entity: 'Coupon', entityId: coupon.id, metadata: { code, discountType } });
    return redirect(req);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
