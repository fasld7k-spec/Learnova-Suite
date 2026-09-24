import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const couponId = String(f.get('couponId') || '');
    const action = String(f.get('action') || '');
    if (!couponId) return fail('Coupon is required.', 422);
    if (!['activate', 'pause'].includes(action)) return fail('Invalid coupon action.', 422);

    const coupon = await prisma.coupon.findFirst({
      where: { id: couponId, instructorId: user.id },
      select: { id: true },
    });
    if (!coupon) return fail('Coupon not found.', 404);

    await prisma.coupon.update({
      where: { id: coupon.id },
      data: { active: action === 'activate' },
    });
    await audit({
      actorId: user.id,
      action: action === 'activate' ? 'instructor.coupon.activate' : 'instructor.coupon.pause',
      entity: 'coupon',
      entityId: coupon.id,
    });

    return NextResponse.redirect(new URL('/instructor/coupons', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
