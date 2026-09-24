import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { markOrderPaid } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/secret-fields';
import { WebhookVerificationError } from '@/lib/webhooks';
import { assertAllowedPayPalBaseUrl } from '@/lib/egress-url';

async function paypalConfig() {
  const row = await prisma.paymentMethod.findUnique({ where: { slug: 'paypal' } }).catch(() => null);
  const config = fromJsonObject<any>(row?.config);
  const mode = String(config.mode || process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

  return {
    baseUrl: assertAllowedPayPalBaseUrl(String(
      config.baseUrl ||
      process.env.PAYPAL_BASE_URL ||
      (mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')
    )),
    clientId: String(config.accountId || config.publicKey || process.env.PAYPAL_CLIENT_ID || ''),
    clientSecret: String(
      decryptSecret(config.clientSecret) ||
      decryptSecret(config.secretKey) ||
      decryptSecret(config.apiKey) ||
      process.env.PAYPAL_CLIENT_SECRET ||
      ''
    ),
    webhookId: String(config.webhookId || config.webhookLabel || process.env.PAYPAL_WEBHOOK_ID || ''),
  };
}

async function paypalAccessToken() {
  const config = await paypalConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new WebhookVerificationError('PayPal API credentials are not configured', 503);
  }

  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    redirect: 'manual',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new WebhookVerificationError(data?.error_description || 'PayPal access token request failed', 503);
  }
  return { accessToken: String(data.access_token), config };
}

function requiredPayPalHeader(req: NextRequest, name: string) {
  const value = req.headers.get(name);
  if (!value) throw new WebhookVerificationError(`Missing PayPal webhook header: ${name}`);
  return value;
}

async function readVerifiedPayPalWebhook(req: NextRequest) {
  const rawBody = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch {
    throw new WebhookVerificationError('Invalid PayPal webhook JSON', 400);
  }

  const { accessToken, config } = await paypalAccessToken();
  if (!config.webhookId) {
    throw new WebhookVerificationError('PAYPAL_WEBHOOK_ID is not configured', 503);
  }

  const certUrl = requiredPayPalHeader(req, 'paypal-cert-url');
  const parsedCertUrl = new URL(certUrl);
  if (parsedCertUrl.protocol !== 'https:' || !parsedCertUrl.hostname.endsWith('paypal.com')) {
    throw new WebhookVerificationError('Invalid PayPal certificate URL');
  }

  const verificationBody = {
    transmission_id: requiredPayPalHeader(req, 'paypal-transmission-id'),
    transmission_time: requiredPayPalHeader(req, 'paypal-transmission-time'),
    cert_url: certUrl,
    auth_algo: requiredPayPalHeader(req, 'paypal-auth-algo'),
    transmission_sig: requiredPayPalHeader(req, 'paypal-transmission-sig'),
    webhook_id: config.webhookId,
    webhook_event: payload,
  };

  const response = await fetch(`${config.baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verificationBody),
    redirect: 'manual',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.verification_status !== 'SUCCESS') {
    throw new WebhookVerificationError('Invalid PayPal webhook signature');
  }

  return payload;
}

function paypalOrderReference(payload: any) {
  return (
    payload.resource?.custom_id ||
    payload.resource?.supplementary_data?.related_ids?.order_id ||
    payload.resource?.invoice_id ||
    ''
  );
}

function paypalProviderOrderId(payload: any) {
  return payload.resource?.supplementary_data?.related_ids?.order_id || '';
}

function assertPayPalWebhookMatchesOrder(payload: any, payment: { gateway: string; transactionId: string | null; order: { id: string; total: unknown; currency: string; invoiceNumber: string; status: string; gateway: string } }) {
  if (payment.gateway !== 'paypal' && payment.order.gateway !== 'paypal') {
    throw new Error('PayPal webhook gateway does not match the order.');
  }

  const relatedOrderId = paypalProviderOrderId(payload);
  if (payment.transactionId && relatedOrderId && payment.transactionId !== relatedOrderId) {
    throw new Error('PayPal webhook order id does not match the stored payment session.');
  }

  const amount = payload.resource?.amount;
  if (!amount) throw new Error('PayPal webhook amount is missing.');
  if (String(amount.currency_code || '').toUpperCase() !== payment.order.currency.toUpperCase()) {
    throw new Error('PayPal webhook currency does not match the order.');
  }
  if (Number(amount.value).toFixed(2) !== Number(payment.order.total).toFixed(2)) {
    throw new Error('PayPal webhook amount does not match the order.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await readVerifiedPayPalWebhook(req);
    const eventId = payload.id || payload.resource?.id;
    const existing = eventId ? await prisma.webhookEvent.findFirst({ where: { provider: 'paypal', eventId } }) : null;
    if (existing?.processed) return ok({ received: true, duplicate: true });
    await prisma.webhookEvent.create({ data: { provider: 'paypal', eventId, payload: toJson(payload) } }).catch(() => null);

    if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED' || payload.status === 'COMPLETED') {
      const reference = paypalOrderReference(payload);
      const payment = reference
        ? await prisma.payment.findFirst({
            where: {
              OR: [
                { orderId: reference },
                { transactionId: reference },
                { order: { invoiceNumber: reference } },
              ],
            },
            include: { order: true },
          })
        : null;

      if (payment?.orderId) {
        assertPayPalWebhookMatchesOrder(payload, payment);
        if (payment.order.status !== 'PAID') await markOrderPaid(payment.orderId, payload.resource?.id || reference);
        await prisma.webhookEvent.updateMany({ where: { provider: 'paypal', eventId }, data: { processed: true } });
      }
    }

    return ok({ received: true });
  } catch (e: any) {
    if (e instanceof WebhookVerificationError) return fail(e.message, e.status);
    return fail(e.message || 'Webhook failed', 500);
  }
}
