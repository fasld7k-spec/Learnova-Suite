import { NextRequest, NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { getSession } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { markOrderPaid } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { fail, handleGatewayError } from '@/lib/api';
import { isMockPaymentEnabled, isOfflineGateway, normalizeGateway } from '@/lib/payment-gateways';

export async function POST(req: NextRequest) {
  try {
    if (!isMockPaymentEnabled()) {
      return fail('Test payment confirmation is disabled.', 403);
    }

    const session = await getSession();
    if (!session) return NextResponse.redirect(new URL('/login', req.url), 303);

    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const orderId = String(f.get('orderId') || '');
    const reference = String(f.get('reference') || `mock-${Date.now()}`);
    const gateway = normalizeGateway(String(f.get('gateway') || 'sandbox'));

    const order = await prisma.order.findFirst({
      where: { id: orderId, ...(session.role === 'ADMIN' ? {} : { userId: session.id }) }
    });
    if (!order) return fail('Order not found', 404);
    if (order.gateway !== gateway) return fail('Payment gateway does not match this order.', 409);
    if (isOfflineGateway(order.gateway) || order.gateway === 'free') return fail('Test payment confirmation is available only for online sandbox gateways.', 422);

    if (order.status !== 'PAID') {
      await markOrderPaid(order.id, `${gateway}-${reference}`);
      await audit({
        actorId: session.id,
        action: 'payment.mock.confirm',
        entity: 'order',
        entityId: order.id,
        metadata: { gateway, reference, invoiceNumber: order.invoiceNumber },
      });
    }

    return NextResponse.redirect(new URL(`/payment/success?orderId=${order.id}&gateway=${gateway}&reference=${reference}`, req.url), 303);
  } catch (error: unknown) {
    return handleGatewayError(error);
  }
}
