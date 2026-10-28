import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const order = await prisma.order.findFirst({
      where: {
        id: String(form.get('orderId') || ''),
        ...(user.role === 'ADMIN' ? {} : { userId: user.id }),
      },
    });
    if (!order) return fail('Order not found', 404);
    if (order.status === 'PAID') return fail('This order is already paid.', 409);

    const offlineReference = String(form.get('reference') || '').trim().slice(0, 200);
    const offlineNote = String(form.get('note') || '').trim().slice(0, 2000);
    const payment = await prisma.payment.findUnique({ where: { orderId: order.id }, select: { metadata: true } });
    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        // Merge, don't replace: subscriptionId, couponId and affiliate fields must survive until approval.
        metadata: toJson({
          ...fromJsonObject<Record<string, unknown>>(payment?.metadata),
          offlineReference,
          offlineNote,
          submittedAt: new Date().toISOString(),
          submittedBy: user.id,
        }),
      },
    }).catch(() => null);
    await prisma.notification.create({
      data: {
        userId: order.userId,
        title: 'Payment reference submitted',
        body: `Reference for ${order.invoiceNumber} was submitted and is pending admin approval.`,
      },
    }).catch(() => null);
    await audit({
      actorId: user.id,
      action: 'payment.offline.submit',
      entity: 'order',
      entityId: order.id,
      metadata: { invoiceNumber: order.invoiceNumber, gateway: order.gateway, hasReference: Boolean(offlineReference), hasNote: Boolean(offlineNote) },
    });

    return NextResponse.redirect(new URL(`/invoice?id=${order.id}`, req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
