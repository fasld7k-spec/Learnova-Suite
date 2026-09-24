import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { markOrderPaid } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { readSignedWebhookJson, WebhookVerificationError } from '@/lib/webhooks';

const zeroDecimalCurrencies = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF'
]);

function stripeAmount(value: unknown, currency: string) {
  const amount = Number(value || 0);
  return zeroDecimalCurrencies.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

async function validateStripeCheckoutSession(session: any) {
  const orderId = String(session?.metadata?.orderId || session?.client_reference_id || '');
  if (!orderId) throw new Error('Stripe session is missing order metadata.');

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order) throw new Error('Order not found for Stripe webhook.');
  if (order.gateway !== 'stripe') throw new Error('Stripe webhook gateway does not match the order.');
  if (!['PENDING', 'FAILED'].includes(order.status)) return { order, alreadyFinal: true };

  const expectedAmount = stripeAmount(order.total, order.currency);
  const actualAmount = Number(session.amount_total ?? session.amount_subtotal ?? -1);
  if (actualAmount !== expectedAmount) throw new Error('Stripe webhook amount does not match the order.');

  const actualCurrency = String(session.currency || '').toUpperCase();
  if (actualCurrency !== order.currency.toUpperCase()) throw new Error('Stripe webhook currency does not match the order.');

  const metadata = fromJsonObject<{ providerSessionId?: string }>(order.payment?.metadata);
  const expectedSessionId = metadata.providerSessionId || order.payment?.transactionId;
  if (expectedSessionId && expectedSessionId !== session.id) throw new Error('Stripe session id does not match the stored payment session.');

  if (session.payment_status && session.payment_status !== 'paid') throw new Error('Stripe session is not marked paid.');
  return { order, alreadyFinal: false };
}

export async function POST(req: NextRequest) {
  try {
    const payload = await readSignedWebhookJson(req, 'stripe');
    const eventId = payload.id ? String(payload.id) : null;
    const existing = eventId
      ? await prisma.webhookEvent.findFirst({ where: { provider: 'stripe', eventId } })
      : null;
    if (existing?.processed) return ok({ received: true, duplicate: true });

    await prisma.webhookEvent.create({
      data: { provider: 'stripe', eventId, payload: toJson(payload) }
    }).catch(() => null);

    if (payload.type === 'checkout.session.completed') {
      const session = payload.data?.object;
      const { order, alreadyFinal } = await validateStripeCheckoutSession(session);
      if (!alreadyFinal) await markOrderPaid(order.id, session.payment_intent || session.id);
      if (eventId) {
        await prisma.webhookEvent.updateMany({
          where: { provider: 'stripe', eventId },
          data: { processed: true }
        });
      }
    }

    return ok({ received: true });
  } catch (e: any) {
    if (e instanceof WebhookVerificationError) return fail(e.message, e.status);
    return fail(e.message || 'Webhook failed', 500);
  }
}
