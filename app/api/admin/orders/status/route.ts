import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['PENDING', 'FAILED', 'CANCELLED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/orders', req.url), 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const orderId = String(form.get('orderId') || '').trim();
    const status = String(form.get('status') || '').trim().toUpperCase();
    const note = String(form.get('note') || '').trim();

    if (!orderId) return fail('Order id is required.', 422);
    if (!statuses.has(status)) return fail('Invalid order status.', 422);

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order) return fail('Order not found.', 404);
    if (order.status === 'PAID' && status !== 'FAILED') {
      return fail('Paid orders must be handled through refunds instead of manual cancellation.', 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status } });
      if (status === 'FAILED' || status === 'CANCELLED') {
        await tx.couponRedemption.deleteMany({ where: { orderId } });
      }
      if (order.payment || status === 'FAILED') {
        await tx.payment.upsert({
          where: { orderId },
          update: {
            status: status === 'PENDING' ? 'PENDING' : status,
            metadata: toJson({ adminStatusNote: note, changedBy: admin.id, changedAt: new Date().toISOString() }),
          },
          create: {
            orderId,
            gateway: order.gateway || 'manual-admin',
            status: status === 'PENDING' ? 'PENDING' : status,
            metadata: toJson({ adminStatusNote: note, changedBy: admin.id, changedAt: new Date().toISOString() }),
          },
        });
      }
    });

    await audit({
      actorId: admin.id,
      action: 'order.status',
      entity: 'order',
      entityId: orderId,
      metadata: { from: order.status, to: status, note },
    });

    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Order status update failed.', 500);
  }
}
