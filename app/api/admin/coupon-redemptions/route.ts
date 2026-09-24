import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function olderThan(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();

    if (action === 'purge-old') {
      const days = Math.max(1, Math.round(Number(form.get('days') || 365)));
      const result = await prisma.couponRedemption.deleteMany({ where: { createdAt: { lt: olderThan(days) } } });
      await audit({ actorId: admin.id, action: 'coupon_redemption.purge_old', entity: 'couponRedemption', metadata: { days, deleted: result.count } });
      return NextResponse.redirect(new URL('/admin/coupon-redemptions?purged=1', req.url), 303);
    }

    if (action === 'cleanup-expired-reservations') {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await prisma.couponRedemption.deleteMany({
        where: {
          OR: [
            { orderId: null },
            { order: { status: { in: ['FAILED', 'CANCELLED', 'REFUNDED'] } } },
            { order: { status: 'PENDING', createdAt: { lt: cutoff } } },
          ],
        },
      });
      await audit({ actorId: admin.id, action: 'coupon_redemption.cleanup_expired_reservations', entity: 'couponRedemption', metadata: { deleted: result.count } });
      return NextResponse.redirect(new URL(`/admin/coupon-redemptions?cleaned=${result.count}`, req.url), 303);
    }

    if (action === 'delete') {
      const id = String(form.get('id') || '').trim();
      if (!id) return fail('Coupon redemption ID is required.', 422);
      const row = await prisma.couponRedemption.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: 'coupon_redemption.delete',
        entity: 'couponRedemption',
        entityId: row.id,
        metadata: { couponId: row.couponId, userId: row.userId, orderId: row.orderId },
      });
      return NextResponse.redirect(new URL('/admin/coupon-redemptions?deleted=1', req.url), 303);
    }

    return fail('Unsupported coupon redemption action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Coupon redemption action failed.', 500);
  }
}
