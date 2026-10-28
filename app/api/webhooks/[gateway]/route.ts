/**
 * app/api/webhooks/[gateway]/route.ts
 *
 * Unified webhook handler for all payment gateways.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.8, 2.9, 2.10, 2.11
 *
 * Flow:
 *   1. Read raw body as string BEFORE any JSON parsing (Req 2.1)
 *   2. For Stripe/PayPal: run gateway-specific verification inline (Req 2.2, 2.3)
 *   3. For other gateways: look up the GatewayAdapter and call verifyWebhook
 *      → false  → HTTP 401, no processing (Req 2.8)
 *   4. Idempotency check: if event ID already processed → HTTP 200, skip (Req 2.11)
 *   5. Parse JSON body and route to event handler (Req 2.9)
 *   6. Unrecognized event type → log + HTTP 200 (Req 2.10)
 *   7. Success → HTTP 200 { received: true }
 */

import { createHash, createHmac, timingSafeEqual, createVerify } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { RazorpayAdapter } from '@/lib/payment-gateways/razorpay';
import { PaystackAdapter } from '@/lib/payment-gateways/paystack';
import { FlutterwaveAdapter } from '@/lib/payment-gateways/flutterwave';
import { MollieAdapter } from '@/lib/payment-gateways/mollie';
import { IyzicoAdapter } from '@/lib/payment-gateways/iyzico';
import { PaymobAdapter } from '@/lib/payment-gateways/paymob';
import { TapAdapter } from '@/lib/payment-gateways/tap';
import { HyperPayAdapter } from '@/lib/payment-gateways/hyperpay';
import { MidtransAdapter } from '@/lib/payment-gateways/midtrans';
import { XenditAdapter } from '@/lib/payment-gateways/xendit';
import { SSLCommerzAdapter } from '@/lib/payment-gateways/sslcommerz';
import type { GatewayAdapter } from '@/lib/payment-gateways/base';

import { applyGatewayRuntimeConfig } from '@/lib/payment-gateways';
import { markOrderFailed, markOrderPaid, refundOrder } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { fromJsonObject, toJson } from '@/lib/json-fields';

// ---------------------------------------------------------------------------
// Stripe webhook verification (Req 2.2)
//
// Stripe sends a `stripe-signature` header with the format:
//   t=<timestamp>,v1=<hmac-sha256-hex>[,v0=<previous-format>]
//
// Verification steps:
//   1. Parse the header to extract `t` (timestamp) and `v1` (signature).
//   2. Compute HMAC-SHA256 of `{timestamp}.{rawBody}` using STRIPE_WEBHOOK_SECRET.
//   3. Compare computed signature against `v1` using timing-safe comparison.
//   4. Reject if the timestamp is more than 300 seconds old (replay-attack protection).
// ---------------------------------------------------------------------------

const STRIPE_REPLAY_TOLERANCE_SECONDS = 300;

function verifyStripeWebhook(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook:stripe] STRIPE_WEBHOOK_SECRET is not configured');
    return false;
  }

  // Parse the stripe-signature header
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      parts[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
    }
  }

  const timestamp = parts['t'];
  const v1Signature = parts['v1'];

  if (!timestamp || !v1Signature) {
    console.warn('[webhook:stripe] Missing t= or v1= in stripe-signature header');
    return false;
  }

  // Replay-attack check: reject if timestamp is more than 300 seconds old
  const timestampSeconds = parseInt(timestamp, 10);
  if (isNaN(timestampSeconds)) {
    console.warn('[webhook:stripe] Invalid timestamp in stripe-signature header');
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > STRIPE_REPLAY_TOLERANCE_SECONDS) {
    console.warn(`[webhook:stripe] Timestamp too old or too far in the future: ${timestamp}`);
    return false;
  }

  // Compute HMAC-SHA256 of "{timestamp}.{rawBody}"
  const signedPayload = `${timestamp}.${rawBody}`;
  const computedHmac = createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Timing-safe comparison
  try {
    const computedBuf = Buffer.from(computedHmac, 'hex');
    const expectedBuf = Buffer.from(v1Signature, 'hex');
    if (computedBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(computedBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PayPal webhook verification (Req 2.3)
//
// PayPal sends several headers for RSA-SHA256 verification:
//   paypal-transmission-id   — unique transmission ID
//   paypal-transmission-time — ISO 8601 timestamp
//   paypal-transmission-sig  — base64-encoded RSA-SHA256 signature
//   paypal-cert-url          — URL of PayPal's public certificate (informational)
//
// The verification string is:
//   {paypal-transmission-id}|{paypal-transmission-time}|{PAYPAL_WEBHOOK_ID}|{crc32(rawBody)}
//
// Environment variables required:
//   PAYPAL_WEBHOOK_ID   — the webhook ID registered in PayPal developer dashboard
//   PAYPAL_PUBLIC_CERT  — PayPal's public certificate in PEM format
// ---------------------------------------------------------------------------

/**
 * Compute CRC32 of a string (IEEE 802.3 polynomial).
 * Returns the unsigned 32-bit integer as a decimal string.
 */
function crc32(data: string): number {
  const buf = Buffer.from(data, 'utf8');
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0; // unsigned 32-bit
}

function verifyPayPalWebhook(rawBody: string, req: NextRequest): boolean {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const publicCert = process.env.PAYPAL_PUBLIC_CERT;

  if (!webhookId || !publicCert) {
    console.error('[webhook:paypal] PAYPAL_WEBHOOK_ID or PAYPAL_PUBLIC_CERT is not configured');
    return false;
  }

  const transmissionId = req.headers.get('paypal-transmission-id');
  const transmissionTime = req.headers.get('paypal-transmission-time');
  const transmissionSig = req.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !transmissionSig) {
    console.warn('[webhook:paypal] Missing required PayPal transmission headers');
    return false;
  }

  // Build the verification string
  const bodyCrc32 = crc32(rawBody);
  const verificationString = `${transmissionId}|${transmissionTime}|${webhookId}|${bodyCrc32}`;

  // Verify RSA-SHA256 signature
  try {
    const verifier = createVerify('SHA256');
    verifier.update(verificationString, 'utf8');
    const signatureBuffer = Buffer.from(transmissionSig, 'base64');
    return verifier.verify(publicCert, signatureBuffer);
  } catch (err) {
    console.error('[webhook:paypal] RSA-SHA256 verification threw an exception', { error: String(err) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Gateway registry
// Maps gateway slugs to their adapter instances.
// Adapters are constructed lazily to avoid crashing at startup when env vars
// for unused gateways are not configured.
// ---------------------------------------------------------------------------

type AdapterFactory = () => GatewayAdapter;

const gatewayRegistry: Record<string, AdapterFactory> = {
  razorpay: () => new RazorpayAdapter(),
  paystack: () => new PaystackAdapter(),
  flutterwave: () => new FlutterwaveAdapter(),
  mollie: () => new MollieAdapter(),
  iyzico: () => new IyzicoAdapter(),
  paymob: () => new PaymobAdapter(),
  tap: () => new TapAdapter(),
  hyperpay: () => new HyperPayAdapter(),
  midtrans: () => new MidtransAdapter(),
  xendit: () => new XenditAdapter(),
  sslcommerz: () => new SSLCommerzAdapter(),
};

// Gateways that use inline verification (no GatewayAdapter needed for webhook verification).
// These are handled directly in the POST handler before the adapter lookup.
const inlineVerifiedGateways = new Set<string>(['stripe', 'paypal']);

// ---------------------------------------------------------------------------
// Signature header mapping
// Returns the signature value to pass to adapter.verifyWebhook().
// For gateways where the signature is embedded in the body (Midtrans,
// SSLCommerz, Tap) or not present (Mollie), we return an empty string or
// the body itself — the adapter handles the extraction internally.
// ---------------------------------------------------------------------------

function extractSignature(gateway: string, req: NextRequest, rawBody: string): string {
  switch (gateway) {
    case 'stripe':
      return req.headers.get('stripe-signature') ?? '';

    case 'paypal':
      return req.headers.get('paypal-transmission-sig') ?? '';

    case 'razorpay':
      return req.headers.get('x-razorpay-signature') ?? '';

    case 'paystack':
      return req.headers.get('x-paystack-signature') ?? '';

    case 'flutterwave':
      return req.headers.get('verif-hash') ?? '';

    case 'mollie':
      // Mollie uses API-fetch verification — no signature header.
      // The adapter's verifyWebhook validates the payment ID format in the body.
      return '';

    case 'iyzico':
      return req.headers.get('x-iyzi-signature') ?? '';

    case 'paymob': {
      // Paymob sends the HMAC as a query parameter `hmac` or a header.
      const url = new URL(req.url);
      return (
        url.searchParams.get('hmac') ??
        req.headers.get('hmac') ??
        ''
      );
    }

    case 'tap':
      // Tap embeds `hashstring` in the parsed body; the adapter reads it from
      // the raw payload. We pass the raw body as the signature so the adapter
      // can extract it.
      return rawBody;

    case 'hyperpay':
      // HyperPay sends the signature in `x-initialization-vector` or `signature`.
      return (
        req.headers.get('x-initialization-vector') ??
        req.headers.get('signature') ??
        ''
      );

    case 'midtrans':
      // Midtrans embeds `signature_key` in the body; the adapter parses it
      // from the raw payload. We pass the raw body as the signature.
      return rawBody;

    case 'xendit':
      return req.headers.get('x-callback-token') ?? '';

    case 'sslcommerz':
      // SSLCommerz embeds `verify_sign` in the body; the adapter parses it
      // from the URL-encoded payload. We pass the raw body as the signature.
      return rawBody;

    default:
      // Unknown gateway — return empty string; verification will fail.
      return '';
  }
}

// ---------------------------------------------------------------------------
// Event ID extraction
// Looks for common event ID fields across gateway payload shapes.
// ---------------------------------------------------------------------------

function extractEventId(payload: Record<string, unknown>): string | undefined {
  const id =
    payload['id'] ??
    payload['event_id'] ??
    payload['transaction_id'] ??
    payload['txnid'] ??
    (payload['data'] as Record<string, unknown> | undefined)?.['id'];

  return id != null ? String(id) : undefined;
}

function fallbackEventId(gateway: string, rawBody: string) {
  return `${gateway}-${createHash('sha256').update(rawBody).digest('hex')}`;
}

// ---------------------------------------------------------------------------
// Order ID extraction
// Looks for the internal Learnova order ID across gateway payload shapes.
// ---------------------------------------------------------------------------

function extractOrderId(payload: Record<string, unknown>): string | undefined {
  // Direct fields
  const direct =
    payload['orderId'] ??
    payload['order_id'] ??
    payload['merchant_order_id'];

  if (direct != null) return String(direct);

  // Nested under metadata / data / resource
  const dataObj = payload['data'] as Record<string, unknown> | undefined;
  const dataMeta = dataObj?.['metadata'] as Record<string, unknown> | undefined;
  const nested =
    (payload['metadata'] as Record<string, unknown> | undefined)?.['orderId'] ??
    dataMeta?.['orderId'] ??
    (payload['resource'] as Record<string, unknown> | undefined)?.['custom_id'] ??
    (payload['notes'] as Record<string, unknown> | undefined)?.['orderId'];

  if (nested != null) return String(nested);

  // SSLCommerz stores orderId in value_a
  if (payload['value_a'] != null) return String(payload['value_a']);

  return undefined;
}

function objectAt(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function getPath(source: unknown, path: Array<string | number>): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      const object = objectAt(current);
      if (!object) return undefined;
      current = object[key];
    }
  }
  return current;
}

function firstString(payload: Record<string, unknown>, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const value = getPath(payload, path);
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

function firstNumber(payload: Record<string, unknown>, paths: Array<Array<string | number>>) {
  for (const path of paths) {
    const value = getPath(payload, path);
    if (value == null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

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
  'XPF',
]);

function fromMinorUnits(amount: number, currency?: string) {
  return zeroDecimalCurrencies.has(String(currency || '').toUpperCase()) ? amount : amount / 100;
}

function extractCurrency(payload: Record<string, unknown>) {
  return firstString(payload, [
    ['currency'],
    ['currency_code'],
    ['data', 'currency'],
    ['data', 'object', 'currency'],
    ['data', 'amount', 'currency'],
    ['data', 'amount', 'currency_code'],
    ['amount', 'currency'],
    ['amount', 'currency_code'],
    ['resource', 'amount', 'currency'],
    ['resource', 'amount', 'currency_code'],
    ['purchase_units', 0, 'amount', 'currency_code'],
    ['payment_entity', 'currency'],
    ['obj', 'currency'],
    ['order', 'currency'],
  ])?.toUpperCase();
}

function extractAmount(gateway: string, payload: Record<string, unknown>, currency?: string) {
  const minorUnitAmount = firstNumber(payload, [
    ['amount_cents'],
    ['amount_total'],
    ['amount_paid'],
    ['amount_received'],
    ['data', 'amount_cents'],
    ['data', 'amount_total'],
    ['data', 'amount_paid'],
    ['data', 'object', 'amount_cents'],
    ['data', 'object', 'amount_total'],
    ['data', 'object', 'amount_paid'],
  ]);
  if (minorUnitAmount != null) return fromMinorUnits(minorUnitAmount, currency);

  const amount = firstNumber(payload, [
    ['amount'],
    ['gross_amount'],
    ['paid_amount'],
    ['store_amount'],
    ['data', 'amount'],
    ['data', 'object', 'amount'],
    ['data', 'amount', 'value'],
    ['amount', 'value'],
    ['resource', 'amount', 'value'],
    ['purchase_units', 0, 'amount', 'value'],
    ['payment_entity', 'amount'],
    ['obj', 'amount'],
    ['order', 'amount'],
  ]);
  if (amount == null) return undefined;

  if (['razorpay', 'paystack'].includes(gateway)) {
    return fromMinorUnits(amount, currency);
  }
  return amount;
}

function collectStrings(value: unknown, keys: Set<string>, found = new Set<string>()) {
  if (value == null) return found;
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, keys, found);
    return found;
  }
  if (typeof value !== 'object') return found;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key.toLowerCase()) && nested != null && String(nested).trim()) {
      found.add(String(nested).trim());
    }
    collectStrings(nested, keys, found);
  }
  return found;
}

function extractProviderTransactionId(gateway: string, payload: Record<string, unknown>, eventId: string) {
  const stripeId = firstString(payload, [
    ['data', 'object', 'payment_intent'],
    ['data', 'object', 'charge'],
    ['payment_intent'],
    ['charge'],
  ]);
  if (gateway === 'stripe' && stripeId) return stripeId;

  const paypalId = firstString(payload, [
    ['resource', 'id'],
    ['resource', 'supplementary_data', 'related_ids', 'capture_id'],
    ['resource', 'supplementary_data', 'related_ids', 'order_id'],
  ]);
  if (gateway === 'paypal' && paypalId) return paypalId;

  return firstString(payload, [
    ['transaction_id'],
    ['txnid'],
    ['tx_ref'],
    ['tran_id'],
    ['payment_id'],
    ['paymentId'],
    ['data', 'id'],
    ['data', 'object', 'id'],
    ['obj', 'id'],
    ['order', 'id'],
  ]) || eventId;
}

const referenceKeys = new Set([
  'id',
  'reference',
  'providerreference',
  'providersessionid',
  'paymentid',
  'payment_id',
  'paymentintent',
  'payment_intent',
  'transactionid',
  'transaction_id',
  'txid',
  'txnid',
  'tx_ref',
  'tran_id',
  'order_id',
  'merchant_order_id',
  'merchanttransactionid',
  'conversationid',
  'session_id',
  'access_code',
]);

async function assertWebhookMatchesOrder(
  gateway: string,
  orderId: string,
  payload: Record<string, unknown>,
  options: { requireFinancialMatch?: boolean } = {},
) {
  const requireFinancialMatch = options.requireFinancialMatch ?? true;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) throw new Error('Webhook order was not found.');

  const orderGateway = String(order.gateway || '').toLowerCase();
  const paymentGateway = String(order.payment?.gateway || '').toLowerCase();
  if (orderGateway !== gateway && paymentGateway !== gateway) {
    throw new Error(`Webhook gateway "${gateway}" does not match order gateway "${order.gateway}".`);
  }

  const currency = extractCurrency(payload);
  if (currency) {
    if (currency !== String(order.currency).toUpperCase()) {
      throw new Error(`Webhook currency "${currency}" does not match order currency "${order.currency}".`);
    }
  } else if (requireFinancialMatch) {
    throw new Error('Webhook currency is missing.');
  }

  const amount = currency ? extractAmount(gateway, payload, currency) : undefined;
  if (amount != null) {
    const expectedAmount = Number(order.total);
    if (Math.abs(amount - expectedAmount) > 0.01) {
      throw new Error(`Webhook amount "${amount}" does not match order total "${expectedAmount}".`);
    }
  } else if (requireFinancialMatch) {
    throw new Error('Webhook amount is missing.');
  }

  const metadata = fromJsonObject<{ reference?: string; providerSessionId?: string }>(order.payment?.metadata);
  const expectedReferences = [
    order.payment?.transactionId,
    metadata.providerSessionId,
    metadata.reference,
  ].filter((value): value is string => Boolean(value && String(value).trim()));

  if (expectedReferences.length) {
    const observedReferences = collectStrings(payload, referenceKeys);
    const matched = expectedReferences.some((expected) => observedReferences.has(String(expected).trim()));
    if (!matched) {
      throw new Error('Webhook payment reference does not match the stored checkout session.');
    }
  }
}

// ---------------------------------------------------------------------------
// Event type extraction
// Normalises the event type string across gateway payload shapes.
// ---------------------------------------------------------------------------

function extractEventType(payload: Record<string, unknown>): string {
  return String(
    payload['event'] ??
    payload['type'] ??
    payload['event_type'] ??
    payload['status'] ??
    (payload['resource'] as Record<string, unknown> | undefined)?.['status'] ??
    'unknown',
  ).toLowerCase();
}

async function processedWebhookExists(provider: string, eventId: string) {
  const existing = await prisma.webhookEvent.findFirst({
    where: { provider, eventId, processed: true },
    select: { id: true }
  }).catch(() => null);
  return Boolean(existing);
}

async function persistWebhookEvent(provider: string, eventId: string, payload: Record<string, unknown>) {
  const existing = await prisma.webhookEvent.findFirst({
    where: { provider, eventId },
    select: { id: true }
  }).catch(() => null);
  if (existing) return existing;

  return prisma.webhookEvent.create({
    data: {
      provider,
      eventId,
      payload: toJson(payload),
      processed: false,
    },
    select: { id: true }
  }).catch(async (err) => {
    console.warn(`[webhook:${provider}] Failed to persist webhook event`, { error: String(err) });
    return prisma.webhookEvent.findFirst({
      where: { provider, eventId },
      select: { id: true }
    }).catch(() => null);
  });
}

async function markWebhookEventProcessed(provider: string, eventId: string) {
  await prisma.webhookEvent.updateMany({
    where: { provider, eventId },
    data: { processed: true },
  }).catch((err) => {
    console.warn(`[webhook:${provider}] Failed to mark webhook event as processed`, { error: String(err) });
  });
}

// ---------------------------------------------------------------------------
// Event routing
// Maps normalised event type strings to order state transitions.
// ---------------------------------------------------------------------------

async function routeEvent(
  gateway: string,
  eventType: string,
  orderId: string,
  eventId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const isSuccess =
    eventType.includes('success') ||
    eventType.includes('paid') ||
    eventType.includes('completed') ||
    eventType.includes('captured') ||
    eventType.includes('settlement') ||
    eventType.includes('charge.success') ||
    eventType.includes('checkout.session.completed') ||
    eventType.includes('payment.captured') ||
    eventType.includes('charge.completed');

  const isRefund =
    eventType.includes('refund') ||
    eventType.includes('chargeback');

  const isFailure =
    eventType.includes('fail') ||
    eventType.includes('cancel') ||
    eventType.includes('voided') ||
    eventType.includes('expired');

  if (isSuccess) {
    await assertWebhookMatchesOrder(gateway, orderId, payload, { requireFinancialMatch: true });
    await markOrderPaid(orderId, extractProviderTransactionId(gateway, payload, eventId));
    return true;
  }

  if (isRefund) {
    await assertWebhookMatchesOrder(gateway, orderId, payload, { requireFinancialMatch: true });
    await refundOrder(orderId, eventId);
    return true;
  }

  if (isFailure) {
    await assertWebhookMatchesOrder(gateway, orderId, payload, { requireFinancialMatch: false });
    await markOrderFailed(orderId, eventType);
    return true;
  }

  // Unrecognized event type — log and return false to signal no processing
  console.log(`[webhook:${gateway}] Unrecognized event type: "${eventType}" for order ${orderId}`);
  return false;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gateway: string }> },
) {
  const { gateway: gatewayParam } = await params;
  const gateway = gatewayParam.toLowerCase().trim();

  // ------------------------------------------------------------------
  // Step 1: Read raw body as string BEFORE any JSON parsing (Req 2.1)
  // ------------------------------------------------------------------
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error(`[webhook:${gateway}] Failed to read request body`, { error: String(err) });
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // ------------------------------------------------------------------
  // Step 2: Handle Stripe and PayPal with inline verification (Req 2.2, 2.3)
  // These gateways don't use a GatewayAdapter — verification is done here.
  // ------------------------------------------------------------------
  await applyGatewayRuntimeConfig(gateway);

  if (inlineVerifiedGateways.has(gateway)) {
    let verified = false;

    if (gateway === 'stripe') {
      const sigHeader = req.headers.get('stripe-signature') ?? '';
      verified = verifyStripeWebhook(rawBody, sigHeader);
    } else if (gateway === 'paypal') {
      verified = verifyPayPalWebhook(rawBody, req);
    }

    if (!verified) {
      console.warn(`[webhook:${gateway}] Signature verification failed`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Signature is valid — fall through to body parsing and event routing below.
    // We skip the adapter lookup entirely for these gateways.
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      console.error(`[webhook:${gateway}] Failed to parse webhook body`);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const eventId = extractEventId(payload) ?? fallbackEventId(gateway, rawBody);

    if (await processedWebhookExists(gateway, eventId)) {
      console.log(`[webhook:${gateway}] Duplicate processed event ID "${eventId}" - skipping`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await persistWebhookEvent(gateway, eventId, payload);

    const orderId = extractOrderId(payload);
    const eventType = extractEventType(payload);

    if (!orderId) {
      console.log(`[webhook:${gateway}] No orderId found for event type "${eventType}" — acknowledging without processing`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    let processed = false;
    try {
      processed = await routeEvent(gateway, eventType, orderId, eventId, payload);
    } catch (err) {
      console.error(`[webhook:${gateway}] Event routing failed`, {
        eventType,
        orderId,
        eventId,
        error: String(err),
      });
      return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
    }

    if (!processed) {
      console.log(`[webhook:${gateway}] Unrecognized event type "${eventType}" — returning 200`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await markWebhookEventProcessed(gateway, eventId);

    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ------------------------------------------------------------------
  // Step 3: Look up the adapter for adapter-based gateways
  // ------------------------------------------------------------------
  const adapterFactory = gatewayRegistry[gateway];
  if (!adapterFactory) {
    console.warn(`[webhook] Unknown gateway: "${gateway}"`);
    // Return 200 to avoid retries from unknown sources
    return NextResponse.json({ received: true }, { status: 200 });
  }

  let adapter: GatewayAdapter;
  try {
    adapter = adapterFactory();
  } catch (err) {
    // Adapter construction failed (e.g. missing env vars) — log and return 503
    console.error(`[webhook:${gateway}] Adapter construction failed`, { error: String(err) });
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 503 });
  }

  // ------------------------------------------------------------------
  // Step 4: Extract the signature for this gateway
  // ------------------------------------------------------------------
  const signature = extractSignature(gateway, req, rawBody);

  // ------------------------------------------------------------------
  // Step 5: Verify the webhook signature (Req 2.8)
  // ------------------------------------------------------------------
  let signatureValid: boolean;
  try {
    signatureValid = adapter.verifyWebhook(rawBody, signature);
  } catch (err) {
    console.error(`[webhook:${gateway}] verifyWebhook threw an exception`, { error: String(err) });
    signatureValid = false;
  }

  if (!signatureValid) {
    console.warn(`[webhook:${gateway}] Signature verification failed`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ------------------------------------------------------------------
  // Step 6: Parse the JSON body
  // ------------------------------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    // Some gateways (Mollie, SSLCommerz) send URL-encoded bodies.
    // Parse as URLSearchParams and convert to a plain object.
    try {
      const urlParams = new URLSearchParams(rawBody);
      payload = Object.fromEntries(urlParams.entries());
    } catch {
      console.error(`[webhook:${gateway}] Failed to parse webhook body`);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
  }

  // Mollie webhooks are unsigned and only carry the payment ID: replace the
  // client-supplied body with the payment as reported by the Mollie API.
  if (adapter instanceof MollieAdapter) {
    const trusted = await adapter.fetchTrustedWebhookPayload(rawBody);
    if (!trusted) {
      console.warn(`[webhook:${gateway}] Payment could not be verified with the Mollie API`);
      return NextResponse.json({ error: 'Invalid payment' }, { status: 401 });
    }
    payload = trusted;
  }

  // ------------------------------------------------------------------
  // Step 7: Extract event ID and check idempotency (Req 2.11)
  // ------------------------------------------------------------------
  const eventId = extractEventId(payload) ?? fallbackEventId(gateway, rawBody);

  if (await processedWebhookExists(gateway, eventId)) {
    console.log(`[webhook:${gateway}] Duplicate processed event ID "${eventId}" - skipping`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ------------------------------------------------------------------
  // Step 8: Persist the raw webhook event for audit / replay
  // ------------------------------------------------------------------
  await persistWebhookEvent(gateway, eventId, payload);

  // ------------------------------------------------------------------
  // Step 9: Extract order ID and event type
  // ------------------------------------------------------------------
  const orderId = extractOrderId(payload);
  const eventType = extractEventType(payload);

  // ------------------------------------------------------------------
  // Step 10: Route to the appropriate event handler (Req 2.9 / 2.10)
  // ------------------------------------------------------------------
  if (!orderId) {
    // No order ID — log the event type and return 200 (Req 2.10)
    console.log(`[webhook:${gateway}] No orderId found for event type "${eventType}" — acknowledging without processing`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  let processed = false;
  try {
    processed = await routeEvent(gateway, eventType, orderId, eventId, payload);
  } catch (err) {
    console.error(`[webhook:${gateway}] Event routing failed`, {
      eventType,
      orderId,
      eventId,
      error: String(err),
    });
    // Return 500 so the gateway retries the webhook
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }

  if (!processed) {
    // Unrecognized event type — return 200 without processing (Req 2.10)
    console.log(`[webhook:${gateway}] Unrecognized event type "${eventType}" — returning 200`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ------------------------------------------------------------------
  // Step 11: Mark event as processed (idempotency) and update DB record
  // ------------------------------------------------------------------
  await markWebhookEventProcessed(gateway, eventId);

  // ------------------------------------------------------------------
  // Step 12: Return HTTP 200 { received: true } (Req 2.9)
  // ------------------------------------------------------------------
  return NextResponse.json({ received: true }, { status: 200 });
}
