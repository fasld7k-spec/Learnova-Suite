import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireApprovedInstructor } from '@/lib/auth';
import { courseScopeToJson } from '@/lib/coupons';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const code = String(f.get('code') || '').trim().toUpperCase();
    const discountType = String(f.get('discountType') || 'PERCENT').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENT';
    const percent = Number(f.get('percent') || 0);
    const amount = Number(f.get('amount') || 0);
    const starts = String(f.get('startsAt') || '');
    const expires = String(f.get('expiresAt') || '');
    const maxUses = Number(f.get('maxUses') || 0);
    const perUserLimit = Number(f.get('perUserLimit') || 0);
    const minOrderAmount = Number(f.get('minOrderAmount') || 0);
    const selectedCourseIds = fromJsonArray<string>(courseScopeToJson(f.getAll('courseIds')));

    if (!code) return fail('Coupon code is required', 422);
    if (!selectedCourseIds.length) return fail('Choose at least one of your courses.', 422);
    if (discountType === 'PERCENT' && (!Number.isInteger(percent) || percent < 1 || percent > 90)) {
      return fail('Instructor percent discount must be between 1 and 90.', 422);
    }
    if (discountType === 'FIXED' && amount <= 0) return fail('Fixed amount must be greater than zero.', 422);
    if (minOrderAmount < 0) return fail('Minimum order amount cannot be negative.', 422);

    const ownedCourses = await prisma.course.findMany({
      where: { instructorId: user.id, id: { in: selectedCourseIds } },
      select: { id: true },
    });
    const ownedIds = new Set(ownedCourses.map((course) => course.id));
    if (ownedIds.size !== selectedCourseIds.length) return fail('Coupon can only be attached to your own courses.', 403);

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing && existing.instructorId && existing.instructorId !== user.id) return fail('Coupon code is already used by another instructor.', 409);
    if (existing && !existing.instructorId) return fail('Coupon code is reserved by the platform.', 409);

    const payload = {
      percent: discountType === 'PERCENT' ? percent : 0,
      discountType,
      amount: discountType === 'FIXED' ? amount : 0,
      active: f.get('active') === 'on',
      startsAt: starts ? new Date(starts) : null,
      expiresAt: expires ? new Date(expires) : null,
      maxUses: maxUses > 0 ? maxUses : null,
      perUserLimit: perUserLimit > 0 ? perUserLimit : null,
      minOrderAmount,
      courseIds: courseScopeToJson(selectedCourseIds),
      instructorId: user.id,
    };

    const coupon = await prisma.coupon.upsert({
      where: { code },
      update: payload,
      create: { code, ...payload },
    });
    await audit({
      actorId: user.id,
      action: 'instructor.coupon.upsert',
      entity: 'coupon',
      entityId: coupon.id,
      metadata: { code, selectedCourseIds, discountType },
    });

    return NextResponse.redirect(new URL('/instructor/coupons', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
