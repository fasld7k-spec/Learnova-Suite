import { NextRequest, NextResponse } from 'next/server';
import { fail, handleGatewayError } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { markOrderPaid } from '@/lib/payments';
import { capturePayPalOrder } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';

function assertPayPalCaptureMatchesOrder(capture: any, order: { id: string; total: unknown; currency: string; invoiceNumber: string }) {
  const purchaseUnit = Array.isArray(capture.data?.purchase_units)
    ? capture.data.purchase_units.find((unit: any) => unit.reference_id === order.id || unit.invoice_id === order.invoiceNumber || unit.custom_id === order.id) || capture.data.purchase_units[0]
    : null;
  const captured = purchaseUnit?.payments?.captures?.[0];
  const amount = captured?.amount || purchaseUnit?.amount;
  if (!amount) throw new Error('PayPal capture amount is missing.');
  if (String(amount.currency_code || '').toUpperCase() !== order.currency.toUpperCase()) throw new Error('PayPal capture currency does not match this invoice.');
  if (Number(amount.value).toFixed(2) !== Number(order.total).toFixed(2)) throw new Error('PayPal capture amount does not match this invoice.');
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.redirect(new URL('/login', req.url), 303);

    const orderId = req.nextUrl.searchParams.get('orderId') || '';
    const providerOrderId = req.nextUrl.searchParams.get('token') || '';
    const reference = req.nextUrl.searchParams.get('reference') || providerOrderId;

    if (!orderId || !providerOrderId) return fail('Missing PayPal capture parameters.', 422);

    const order = await prisma.order.findFirst({
      where: { id: orderId, gateway: 'paypal', ...(session.role === 'ADMIN' ? {} : { userId: session.id }) },
      include: { payment: true },
    });
    if (!order) return fail('Order not found.', 404);
    if (order.status === 'PAID') {
      return NextResponse.redirect(new URL(`/payment/success?orderId=${order.id}&gateway=paypal&reference=${reference}`, req.url), 303);
    }
    if (order.payment?.transactionId && order.payment.transactionId !== providerOrderId) {
      return fail('PayPal order reference does not match this invoice.', 409);
    }

    const capture = await capturePayPalOrder(providerOrderId);
    assertPayPalCaptureMatchesOrder(capture, order);
    await markOrderPaid(order.id, capture.captureId);

    return NextResponse.redirect(new URL(`/payment/success?orderId=${order.id}&gateway=paypal&reference=${reference}`, req.url), 303);
  } catch (error: unknown) {
    return handleGatewayError(error);
  }
}
