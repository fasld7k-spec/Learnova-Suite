import { prisma } from '@/lib/prisma';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { getSiteSettings } from '@/lib/site-settings';
import { decryptSecret } from '@/lib/secret-fields';
import { assertAllowedPayPalBaseUrl } from '@/lib/egress-url';
import { isGatewayError, type GatewayAdapter, type Order as GatewayOrder } from '@/lib/payment-gateways/base';
import { FlutterwaveAdapter } from '@/lib/payment-gateways/flutterwave';
import { HyperPayAdapter } from '@/lib/payment-gateways/hyperpay';
import { IyzicoAdapter } from '@/lib/payment-gateways/iyzico';
import { MidtransAdapter } from '@/lib/payment-gateways/midtrans';
import { MollieAdapter } from '@/lib/payment-gateways/mollie';
import { PaymobAdapter } from '@/lib/payment-gateways/paymob';
import { PaystackAdapter } from '@/lib/payment-gateways/paystack';
import { RazorpayAdapter } from '@/lib/payment-gateways/razorpay';
import { SSLCommerzAdapter } from '@/lib/payment-gateways/sslcommerz';
import { TapAdapter } from '@/lib/payment-gateways/tap';
import { XenditAdapter } from '@/lib/payment-gateways/xendit';
import { resolveAppUrl } from '@/lib/app-url';

export const SUPPORTED_GATEWAYS = [
  'stripe',
  'paypal',
  'razorpay',
  'paystack',
  'flutterwave',
  'mollie',
  'iyzico',
  'paymob',
  'tap',
  'hyperpay',
  'midtrans',
  'xendit',
  'sslcommerz',
  'manual',
  'bank_transfer',
  'cod',
  'free',
] as const;

export const NATIVE_REDIRECT_GATEWAYS = [
  'razorpay',
  'paystack',
  'flutterwave',
  'mollie',
  'paymob',
  'tap',
  'midtrans',
  'xendit',
  'sslcommerz',
] as const;

export const INLINE_NATIVE_GATEWAYS = ['iyzico', 'hyperpay'] as const;

export type GatewaySlug = (typeof SUPPORTED_GATEWAYS)[number];
export type PaymentSession = {
  gateway: GatewaySlug | string;
  orderId: string;
  redirectUrl: string;
  reference: string;
  mode: 'redirect' | 'manual' | 'offline' | 'free' | 'inline';
  providerSessionId?: string;
  instructions?: string;
  payload?: Record<string, any>;
};

export type RefundPaymentOutcome = {
  gateway: string;
  mode: 'provider' | 'manual' | 'offline' | 'unsupported';
  message: string;
  amount: number;
  currency: string;
  transactionId?: string;
  providerRefundId?: string;
  rawResponse?: Record<string, unknown>;
};

export const gatewayLabels: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  razorpay: 'Razorpay',
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  mollie: 'Mollie',
  iyzico: 'Iyzico',
  paymob: 'Paymob',
  tap: 'Tap Payments',
  hyperpay: 'HyperPay',
  midtrans: 'Midtrans',
  xendit: 'Xendit',
  sslcommerz: 'SSLCommerz',
  manual: 'Manual Payment',
  bank_transfer: 'Bank Transfer',
  cod: 'Cash on Delivery',
  free: 'Free',
};

export function normalizeGateway(gateway?: string | null) {
  const normalized = String(gateway || 'manual')
    .trim()
    .toLowerCase();
  return normalized || 'manual';
}

export function isOfflineGateway(gateway: string) {
  return ['manual', 'bank_transfer', 'cod'].includes(normalizeGateway(gateway));
}

function isBuiltInGateway(gateway: string) {
  return (SUPPORTED_GATEWAYS as readonly string[]).includes(normalizeGateway(gateway));
}

export function gatewaySupportsProviderRefund(gateway: string) {
  const selected = normalizeGateway(gateway);
  return selected === 'stripe' || selected === 'paypal' || Boolean(nativeRedirectGatewayAdapters[selected]);
}

function isConfiguredOfflineGateway(gateway: string, method: { config?: string | null } | null) {
  const config = fromJsonObject<Record<string, unknown>>(method?.config);
  const mode = String(config.mode || '').toLowerCase();
  const providerType = String(config.providerType || '').toLowerCase();
  return isOfflineGateway(gateway) || mode === 'offline' || providerType === 'offline' || (!isBuiltInGateway(gateway) && !config.checkoutUrl);
}

export function isSandboxPaymentEnabled() {
  return process.env.PAYMENT_SANDBOX_MODE === 'true' || process.env.NODE_ENV !== 'production';
}

function boolEnv(name: string) {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

export function isProductionDemoPaymentsAllowed() {
  return process.env.NODE_ENV === 'production' && boolEnv('ALLOW_PRODUCTION_DEMO_PAYMENTS');
}

export function isMockPaymentEnabled() {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!boolEnv('DEMO_MODE') && !boolEnv('PAYMENT_SANDBOX_MODE')) return false;
  return isProductionDemoPaymentsAllowed();
}

export function canAutoActivateDemoPurchases() {
  return process.env.NODE_ENV !== 'production' || isProductionDemoPaymentsAllowed();
}

export async function getActivePaymentMethods() {
  const configured = await prisma.paymentMethod.findMany({ orderBy: { name: 'asc' } }).catch(() => []);
  if (configured.length) return configured.filter((method: any) => method.active);
  return [{
    id: 'manual',
    name: 'Bank Transfer',
    slug: 'manual',
    active: true,
    instructions: 'Transfer the amount then submit your receipt reference.',
    config: null,
  }];
}

export async function ensureGatewayAvailable(gateway: string) {
  const selected = normalizeGateway(gateway);
  if (selected === 'free') return selected;
  const methods = await getActivePaymentMethods();
  const active = methods.some((method: any) => method.active && method.slug === selected);
  if (!active) throw new Error(`${gatewayLabels[selected] || selected} is not active for checkout.`);
  return selected;
}

function ref(order: any, gateway: string) {
  return `${gateway.toUpperCase()}-${order.invoiceNumber}-${Date.now()}`;
}

function renderGatewayTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key) => encodeURIComponent(String(values[key] ?? '')));
}

function assertAbsoluteCheckoutUrl(redirectUrl: string) {
  try {
    return new URL(redirectUrl).toString();
  } catch {
    throw new Error('Hosted checkout URL must be a valid absolute URL.');
  }
}

async function createHostedGatewaySession(order: any, gateway: string, reference: string, successUrl: string, cancelUrl: string) {
  const config = await gatewayConfig(gateway);
  const checkoutUrl = String(config.checkoutUrl || '').trim();
  if (!checkoutUrl) return null;

  const redirectUrl = assertAbsoluteCheckoutUrl(renderGatewayTemplate(checkoutUrl, {
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    amount: Number(order.total).toFixed(2),
    currency: order.currency,
    reference,
    successUrl,
    cancelUrl
  }));

  return {
    providerSessionId: reference,
    redirectUrl,
    instructions: String(config.checkoutInstructions || `Redirecting to ${gatewayLabels[gateway] || gateway} hosted checkout.`)
  };
}

const nativeRedirectGatewayAdapters: Record<string, () => GatewayAdapter> = {
  razorpay: () => new RazorpayAdapter(),
  paystack: () => new PaystackAdapter(),
  flutterwave: () => new FlutterwaveAdapter(),
  mollie: () => new MollieAdapter(),
  paymob: () => new PaymobAdapter(),
  iyzico: () => new IyzicoAdapter(),
  tap: () => new TapAdapter(),
  hyperpay: () => new HyperPayAdapter(),
  midtrans: () => new MidtransAdapter(),
  xendit: () => new XenditAdapter(),
  sslcommerz: () => new SSLCommerzAdapter(),
};

function gatewayOrder(order: any): GatewayOrder {
  return {
    id: order.id,
    userId: order.userId,
    total: Number(order.total),
    currency: order.currency,
    status: order.status,
    gateway: order.gateway,
    invoiceNumber: order.invoiceNumber,
    createdAt: order.createdAt,
    items: order.items.map((item: any) => ({
      id: item.id,
      courseId: item.courseId,
      title: item.title,
      price: Number(item.price),
    })),
  };
}

async function persistGatewaySession(
  order: { id: string; payment?: { metadata?: unknown } | null },
  gateway: string,
  session: { providerSessionId?: string | null },
  metadata: Record<string, unknown>,
) {
  const providerSessionId = String(session.providerSessionId || metadata.reference || '').trim();
  await prisma.$transaction([
    prisma.payment.update({
      where: { orderId: order.id },
      data: {
        gateway: gateway as any,
        transactionId: providerSessionId,
        metadata: toJson({
          ...fromJsonObject(order.payment?.metadata),
          ...metadata,
          providerSessionId,
        }),
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { gateway: gateway as any },
    }),
  ]);
}

async function gatewayCustomerMetadata(userId: string) {
  const userDelegate = (prisma as any).user;
  const profileFieldDelegate = (prisma as any).userProfileField;
  const [user, fields] = await Promise.all([
    userDelegate?.findUnique ? userDelegate.findUnique({ where: { id: userId }, select: { email: true, name: true } }).catch(() => null) : Promise.resolve(null),
    profileFieldDelegate?.findMany ? profileFieldDelegate.findMany({
      where: { userId, key: { in: ['phone', 'billingPhone', 'address', 'city', 'country', 'state', 'postalCode', 'identityNumber', 'nationalId', 'taxId', 'ip'] } },
      select: { key: true, value: true }
    }).catch(() => []) : Promise.resolve([])
  ]);
  const profile = new Map((fields as { key: string; value: string }[]).map((field) => [field.key, field.value]));
  const nameParts = String(user?.name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || user?.name || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || 'User';
  const metadata: Record<string, string> = {};

  if (user?.email) {
    metadata.customerEmail = user.email;
    metadata.email = user.email;
  }
  if (user?.name) metadata.customerName = user.name;
  metadata.firstName = firstName;
  metadata.lastName = lastName;

  for (const [key, value] of profile.entries()) {
    if (value) metadata[key] = value;
  }
  if (!metadata.phone && metadata.billingPhone) metadata.phone = metadata.billingPhone;

  return metadata;
}

async function createNativeRedirectGatewaySession(order: any, gateway: string, reference: string, successUrl: string, cancelUrl: string, customerMetadata: Record<string, string>) {
  const factory = nativeRedirectGatewayAdapters[gateway];
  if (!factory) return null;

  const config = await gatewayConfig(gateway);
  setNativeGatewayEnv(gateway, config);

  let adapter: GatewayAdapter;
  try {
    adapter = factory();
  } catch {
    return null;
  }

  let session: Awaited<ReturnType<GatewayAdapter['createSession']>>;
  try {
    session = await adapter.createSession(gatewayOrder(order), {
      reference,
      successUrl,
      cancelUrl,
      metadata: {
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        ...customerMetadata,
      },
    });
  } catch (error) {
    if (isNativeGatewayConfigError(error)) return null;
    throw error;
  }
  if (isGatewayError(session)) {
    if (isNativeGatewayConfigError(session)) return null;
    throw new Error(session.message || `${gatewayLabels[gateway] || gateway} checkout session failed.`);
  }
  if (session.mode !== 'redirect' && session.mode !== 'inline') return null;
  const redirectUrl = session.mode === 'inline'
    ? `${new URL(successUrl).origin}/checkout/inline/${encodeURIComponent(gateway)}?orderId=${encodeURIComponent(order.id)}`
    : session.redirectUrl;
  if (!redirectUrl) return null;

  await persistGatewaySession(order, gateway, session, {
    reference,
    successUrl,
    cancelUrl,
    nativeAdapter: true,
    inlineCheckout: session.mode === 'inline',
    gatewayPayload: session.payload || undefined,
  });

  return {
    gateway,
    orderId: order.id,
    reference,
    mode: session.mode === 'inline' ? 'inline' as const : 'redirect' as const,
    redirectUrl,
    instructions: session.instructions || `${gatewayLabels[gateway] || gateway} checkout session created.`,
    payload: session.payload,
  };
}

function setEnvIfMissing(name: string, value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized && !process.env[name]) process.env[name] = normalized;
}

function setNativeGatewayEnv(gateway: string, config: Record<string, any>) {
  const secretKey = config.secretKey || config.apiKey;
  const publicKey = config.publicKey || config.accountId;
  const clientSecret = config.clientSecret;
  const webhookSecret = config.webhookSecret || config.webhookToken || config.signingSecret;

  if (gateway === 'razorpay') {
    setEnvIfMissing('RAZORPAY_KEY_ID', config.keyId || publicKey);
    setEnvIfMissing('RAZORPAY_KEY_SECRET', config.keySecret || clientSecret || secretKey);
    setEnvIfMissing('RAZORPAY_WEBHOOK_SECRET', webhookSecret);
  } else if (gateway === 'paystack') {
    setEnvIfMissing('PAYSTACK_SECRET_KEY', secretKey);
  } else if (gateway === 'flutterwave') {
    setEnvIfMissing('FLUTTERWAVE_SECRET_KEY', secretKey);
    setEnvIfMissing('FLUTTERWAVE_SECRET_HASH', webhookSecret);
  } else if (gateway === 'mollie') {
    setEnvIfMissing('MOLLIE_API_KEY', secretKey);
  } else if (gateway === 'paymob') {
    setEnvIfMissing('PAYMOB_API_KEY', config.paymobApiKey || secretKey);
    setEnvIfMissing('PAYMOB_INTEGRATION_ID', config.integrationId || config.paymobIntegrationId || config.publicKey);
    setEnvIfMissing('PAYMOB_IFRAME_ID', config.iframeId || config.paymobIframeId || config.accountId);
    setEnvIfMissing('PAYMOB_HMAC_SECRET', config.hmacSecret || webhookSecret);
  } else if (gateway === 'tap') {
    setEnvIfMissing('TAP_SECRET_KEY', secretKey);
  } else if (gateway === 'midtrans') {
    setEnvIfMissing('MIDTRANS_SERVER_KEY', config.serverKey || secretKey);
    setEnvIfMissing('MIDTRANS_CLIENT_KEY', config.clientKey || publicKey);
    setEnvIfMissing('MIDTRANS_IS_PRODUCTION', isLiveGatewayConfig(config) ? 'true' : '');
  } else if (gateway === 'xendit') {
    setEnvIfMissing('XENDIT_SECRET_KEY', secretKey);
    setEnvIfMissing('XENDIT_WEBHOOK_TOKEN', webhookSecret);
  } else if (gateway === 'sslcommerz') {
    setEnvIfMissing('SSLCOMMERZ_STORE_ID', config.storeId || config.accountId || config.publicKey);
    setEnvIfMissing('SSLCOMMERZ_STORE_PASSWORD', config.storePassword || clientSecret || secretKey);
    setEnvIfMissing('SSLCOMMERZ_IS_LIVE', isLiveGatewayConfig(config) ? 'true' : '');
  } else if (gateway === 'iyzico') {
    setEnvIfMissing('IYZICO_API_KEY', config.apiKey || config.publicKey || config.accountId);
    setEnvIfMissing('IYZICO_SECRET_KEY', config.keySecret || clientSecret || secretKey);
    setEnvIfMissing('IYZICO_BASE_URL', config.baseUrl);
  } else if (gateway === 'hyperpay') {
    setEnvIfMissing('HYPERPAY_ACCESS_TOKEN', secretKey);
    setEnvIfMissing('HYPERPAY_ENTITY_ID', config.entityId || config.accountId || config.merchantId);
    setEnvIfMissing('HYPERPAY_BASE_URL', config.baseUrl);
  }
}

function isLiveGatewayConfig(config: Record<string, any>) {
  return config.mode === 'live' || config.isLive === true || config.isLive === 'true' || config.isProduction === true || config.isProduction === 'true';
}

function isNativeGatewayConfigError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: unknown }).message || '') : String(error || '');
  return (
    code === 'CONFIG_ERROR' ||
    code === 'MISSING_CONFIG' ||
    /missing required|environment variable is not set|not configured/i.test(message)
  );
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
  'XPF'
]);

function stripeAmount(value: unknown, currency: string) {
  const amount = Number(value || 0);
  return zeroDecimalCurrencies.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

async function gatewayConfig(slug: string) {
  const row = await prisma.paymentMethod.findUnique({ where: { slug } }).catch(() => null);
  const config = fromJsonObject<any>(row?.config);
  return {
    ...config,
    secretKey: decryptSecret(config.secretKey),
    apiKey: decryptSecret(config.apiKey),
    clientSecret: decryptSecret(config.clientSecret),
    webhookSecret: decryptSecret(config.webhookSecret),
    webhookToken: decryptSecret(config.webhookToken),
    signingSecret: decryptSecret(config.signingSecret),
    keySecret: decryptSecret(config.keySecret),
    hmacSecret: decryptSecret(config.hmacSecret),
    serverKey: decryptSecret(config.serverKey),
    storePassword: decryptSecret(config.storePassword),
    paymobApiKey: decryptSecret(config.paymobApiKey),
    publicCert: decryptSecret(config.publicCert)
  };
}

export async function applyGatewayRuntimeConfig(gateway: string) {
  const selected = normalizeGateway(gateway);
  const config = await gatewayConfig(selected);
  const secretKey = config.secretKey || config.apiKey;
  const webhookSecret = config.webhookSecret || config.webhookToken || config.signingSecret || config.hmacSecret;

  if (selected === 'stripe') {
    setEnvIfMissing('STRIPE_SECRET_KEY', secretKey);
    setEnvIfMissing('STRIPE_WEBHOOK_SECRET', webhookSecret);
  } else if (selected === 'paypal') {
    setEnvIfMissing('PAYPAL_CLIENT_ID', config.accountId || config.publicKey);
    setEnvIfMissing('PAYPAL_CLIENT_SECRET', config.clientSecret || secretKey);
    setEnvIfMissing('PAYPAL_WEBHOOK_ID', config.webhookLabel || config.webhookId || config.accountId);
    setEnvIfMissing('PAYPAL_PUBLIC_CERT', config.publicCert);
    setEnvIfMissing('PAYPAL_BASE_URL', config.baseUrl);
  } else {
    setNativeGatewayEnv(selected, config);
  }

  return config;
}

async function hasStripeConfig() {
  const config = await gatewayConfig('stripe');
  return Boolean(config.secretKey || config.apiKey || process.env.STRIPE_SECRET_KEY);
}

async function hasPayPalConfig() {
  const config = await gatewayConfig('paypal');
  return Boolean((config.accountId || config.publicKey || process.env.PAYPAL_CLIENT_ID) && (config.clientSecret || config.secretKey || process.env.PAYPAL_CLIENT_SECRET));
}

async function createStripeSession(order: any, reference: string, successUrl: string, cancelUrl: string) {
  const config = await gatewayConfig('stripe');
  const secretKey = config.secretKey || config.apiKey || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Stripe secret key is required for live checkout.');
  const settings = await getSiteSettings();

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', order.id);
  params.set('metadata[orderId]', order.id);
  params.set('metadata[invoiceNumber]', order.invoiceNumber);
  params.set('metadata[reference]', reference);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', order.currency.toLowerCase());
  params.set('line_items[0][price_data][unit_amount]', String(stripeAmount(order.total, order.currency)));
  params.set('line_items[0][price_data][product_data][name]', `${settings.siteName} order ${order.invoiceNumber}`);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2026-02-25.clover'
    },
    body: params
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data?.error?.message || `Stripe checkout failed (${response.status}).`);
  return { providerSessionId: data.id as string, redirectUrl: data.url as string };
}

async function refundStripePayment(transactionId: string, amount: number, currency: string) {
  const config = await gatewayConfig('stripe');
  const secretKey = config.secretKey || config.apiKey || process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Stripe secret key is required for provider refunds.');
  let paymentIntentId = transactionId;
  if (transactionId.startsWith('cs_')) {
    const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Stripe-Version': '2026-02-25.clover'
      }
    });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !session.payment_intent) {
      throw new Error(session?.error?.message || 'Stripe Checkout session does not have a refundable payment intent yet.');
    }
    paymentIntentId = String(session.payment_intent);
  }

  const params = new URLSearchParams();
  if (paymentIntentId.startsWith('ch_')) {
    params.set('charge', paymentIntentId);
  } else {
    params.set('payment_intent', paymentIntentId);
  }
  params.set('amount', String(stripeAmount(amount, currency)));

  const response = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2026-02-25.clover'
    },
    body: params
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) throw new Error(data?.error?.message || `Stripe refund failed (${response.status}).`);
  return {
    success: true,
    refundId: String(data.id),
    amount,
    currency,
    rawResponse: data as Record<string, unknown>,
  };
}

async function paypalBaseUrl() {
  const config = await gatewayConfig('paypal');
  const baseUrl = config.baseUrl || process.env.PAYPAL_BASE_URL || (config.mode === 'live' || process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
  return assertAllowedPayPalBaseUrl(String(baseUrl));
}

async function paypalAccessToken() {
  const config = await gatewayConfig('paypal');
  const clientId = config.accountId || config.publicKey || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = config.clientSecret || config.secretKey || process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal client ID and client secret are required for live checkout.');
  }

  const response = await fetch(`${await paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    redirect: 'manual'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data?.error_description || `PayPal auth failed (${response.status}).`);
  return data.access_token as string;
}

async function createPayPalOrder(order: any, reference: string, successUrl: string, cancelUrl: string) {
  const accessToken = await paypalAccessToken();
  const settings = await getSiteSettings();
  const response = await fetch(`${await paypalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': reference
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order.id,
          invoice_id: order.invoiceNumber,
          custom_id: order.id,
          amount: { currency_code: order.currency, value: Number(order.total).toFixed(2) }
        }
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: settings.siteName,
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: successUrl,
            cancel_url: cancelUrl
          }
        }
      }
    }),
    redirect: 'manual'
  });
  const data = await response.json().catch(() => ({}));
  const approveUrl = Array.isArray(data.links) ? data.links.find((link: any) => link.rel === 'payer-action' || link.rel === 'approve')?.href : null;
  if (!response.ok || !approveUrl) throw new Error(data?.message || `PayPal order creation failed (${response.status}).`);
  return { providerSessionId: data.id as string, redirectUrl: approveUrl as string };
}

export async function capturePayPalOrder(providerOrderId: string) {
  const accessToken = await paypalAccessToken();
  const response = await fetch(`${await paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${providerOrderId}`
    },
    redirect: 'manual'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== 'COMPLETED') {
    throw new Error(data?.message || `PayPal capture failed (${response.status}).`);
  }
  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || providerOrderId;
  return { providerOrderId, captureId: String(captureId), data };
}

async function refundPayPalCapture(captureId: string, amount: number, currency: string) {
  const accessToken = await paypalAccessToken();
  const response = await fetch(`${await paypalBaseUrl()}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `refund-${captureId}-${Date.now()}`
    },
    body: JSON.stringify({
      amount: { currency_code: currency, value: Number(amount).toFixed(2) }
    }),
    redirect: 'manual'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) throw new Error(data?.message || `PayPal refund failed (${response.status}).`);
  return {
    success: true,
    refundId: String(data.id),
    amount,
    currency,
    rawResponse: data as Record<string, unknown>,
  };
}

export async function refundGatewayPayment(order: any): Promise<RefundPaymentOutcome> {
  const selected = normalizeGateway(order.payment?.gateway || order.gateway);
  const amount = Number(order.total || 0);
  const currency = String(order.currency || 'USD').toUpperCase();
  const metadata = fromJsonObject<{ providerSessionId?: string; captureId?: string; reference?: string }>(order.payment?.metadata);
  const storedTransactionId = String(order.payment?.transactionId || '').trim();
  const transactionId = String(
    selected === 'stripe' && storedTransactionId.startsWith('evt_')
      ? metadata.providerSessionId || storedTransactionId
      : storedTransactionId || metadata.captureId || metadata.providerSessionId || '',
  ).trim();

  if (amount <= 0 || selected === 'free') {
    return { gateway: selected, mode: 'manual', message: 'Free orders do not require a provider refund.', amount, currency };
  }

  if (isOfflineGateway(selected)) {
    return { gateway: selected, mode: 'offline', message: 'Offline/manual payment: refund must be completed outside the gateway.', amount, currency };
  }

  if (isSandboxPaymentEnabled()) {
    return { gateway: selected, mode: 'manual', message: 'Sandbox/mock payment: no provider refund was sent. Process or reconcile this refund manually/offline.', amount, currency, transactionId: transactionId || undefined };
  }

  if (!gatewaySupportsProviderRefund(selected)) {
    return { gateway: selected, mode: 'unsupported', message: `${gatewayLabels[selected] || selected} does not have an automated refund adapter. Process this refund manually/offline.`, amount, currency, transactionId: transactionId || undefined };
  }

  if (!transactionId) {
    return { gateway: selected, mode: 'manual', message: `${gatewayLabels[selected] || selected} refund requires a provider transaction ID. Process this refund manually/offline.`, amount, currency };
  }

  if (selected === 'stripe') {
    if (!(await hasStripeConfig())) {
      return { gateway: selected, mode: 'manual', message: 'Stripe credentials are missing; no provider refund was sent. Process this refund manually/offline.', amount, currency, transactionId };
    }
    const result = await refundStripePayment(transactionId, amount, currency);
    return { gateway: selected, mode: 'provider', message: 'Stripe provider refund accepted.', amount: result.amount, currency: result.currency, transactionId, providerRefundId: result.refundId, rawResponse: result.rawResponse };
  }

  if (selected === 'paypal') {
    if (!(await hasPayPalConfig())) {
      return { gateway: selected, mode: 'manual', message: 'PayPal credentials are missing; no provider refund was sent. Process this refund manually/offline.', amount, currency, transactionId };
    }
    const result = await refundPayPalCapture(transactionId, amount, currency);
    return { gateway: selected, mode: 'provider', message: 'PayPal provider refund accepted.', amount: result.amount, currency: result.currency, transactionId, providerRefundId: result.refundId, rawResponse: result.rawResponse };
  }

  const factory = nativeRedirectGatewayAdapters[selected];
  const config = await gatewayConfig(selected);
  setNativeGatewayEnv(selected, config);
  let adapter: GatewayAdapter;
  try {
    adapter = factory();
  } catch (error) {
    if (isNativeGatewayConfigError(error)) {
      return { gateway: selected, mode: 'manual', message: `${gatewayLabels[selected] || selected} credentials are missing; no provider refund was sent. Process this refund manually/offline.`, amount, currency, transactionId };
    }
    throw error;
  }
  let result: Awaited<ReturnType<GatewayAdapter['refundPayment']>>;
  try {
    result = await adapter.refundPayment(transactionId, amount);
  } catch (error) {
    if (isNativeGatewayConfigError(error)) {
      return { gateway: selected, mode: 'manual', message: `${gatewayLabels[selected] || selected} credentials are missing; no provider refund was sent. Process this refund manually/offline.`, amount, currency, transactionId };
    }
    throw error;
  }
  if (isGatewayError(result)) {
    if (result.code === 'NOT_IMPLEMENTED' || /not implemented|not supported/i.test(result.message)) {
      return { gateway: selected, mode: 'unsupported', message: `${gatewayLabels[selected] || selected} does not support automated refunds in this adapter. Process this refund manually/offline.`, amount, currency, transactionId };
    }
    throw new Error(result.message || `${gatewayLabels[selected] || selected} refund failed.`);
  }

  return {
    gateway: selected,
    mode: 'provider',
    message: `${gatewayLabels[selected] || selected} provider refund accepted.`,
    amount: result.amount,
    currency: result.currency,
    transactionId,
    providerRefundId: result.refundId,
    rawResponse: result.rawResponse,
  };
}

export async function createGatewaySession(orderId: string, gateway?: string, baseUrl?: string): Promise<PaymentSession> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true, items: true } });
  if (!order) throw new Error('Order not found');

  const selected = normalizeGateway(gateway || order.gateway);
  const customerMetadata = await gatewayCustomerMetadata(order.userId);
  const reference = ref(order, selected);
  const settings = await getSiteSettings();
  const appUrl = resolveAppUrl({ configured: settings.publicAppUrl || baseUrl });
  const successUrl = `${appUrl}/payment/success?orderId=${order.id}&gateway=${selected}&reference=${reference}`;
  const cancelUrl = `${appUrl}/payment/cancel?orderId=${order.id}&gateway=${selected}`;

  if (Number(order.total) <= 0 || selected === 'free') {
    return { gateway: 'free', orderId: order.id, reference, mode: 'free', redirectUrl: successUrl, instructions: 'Free order.' };
  }

  await ensureGatewayAvailable(selected);
  const configuredMethod = await prisma.paymentMethod.findUnique({ where: { slug: selected } }).catch(() => null);

  if (isConfiguredOfflineGateway(selected, configuredMethod)) {
    return {
      gateway: selected,
      orderId: order.id,
      reference,
      mode: 'offline',
      redirectUrl: `${appUrl}/checkout/manual?orderId=${order.id}`,
      instructions: configuredMethod?.instructions || 'Complete offline payment and submit reference.',
      payload: { invoiceNumber: order.invoiceNumber, amount: Number(order.total), currency: order.currency },
    };
  }

  if (!isSandboxPaymentEnabled() && selected === 'stripe' && await hasStripeConfig()) {
    const session = await createStripeSession(order, reference, successUrl, cancelUrl);
    await persistGatewaySession(order, selected, session, { reference, successUrl, cancelUrl });
    return { gateway: selected, orderId: order.id, reference, mode: 'redirect', redirectUrl: session.redirectUrl, instructions: 'Stripe Checkout session created.' };
  }

  if (!isSandboxPaymentEnabled() && selected === 'paypal' && await hasPayPalConfig()) {
    const captureUrl = `${appUrl}/api/payments/paypal/capture?orderId=${order.id}&gateway=paypal&reference=${encodeURIComponent(reference)}`;
    const session = await createPayPalOrder(order, reference, captureUrl, cancelUrl);
    await persistGatewaySession(order, selected, session, { reference, successUrl, cancelUrl });
    return { gateway: selected, orderId: order.id, reference, mode: 'redirect', redirectUrl: session.redirectUrl, instructions: 'PayPal order created.' };
  }

  if (!isSandboxPaymentEnabled() && !['stripe', 'paypal'].includes(selected)) {
    const nativeSession = await createNativeRedirectGatewaySession(order, selected, reference, successUrl, cancelUrl, customerMetadata);
    if (nativeSession) return nativeSession;

    const session = await createHostedGatewaySession(order, selected, reference, successUrl, cancelUrl);
    if (session) {
      await persistGatewaySession(order, selected, session, {
        reference,
        successUrl,
        cancelUrl,
        hostedCheckout: true,
      });
      return { gateway: selected, orderId: order.id, reference, mode: 'redirect', redirectUrl: session.redirectUrl, instructions: session.instructions };
    }
  }

  if (!isSandboxPaymentEnabled()) {
    throw new Error(`${gatewayLabels[selected] || selected} is not configured for live checkout. Add a hosted checkout URL in admin settings or use manual payment.`);
  }

  await persistGatewaySession(
    order,
    selected,
    { providerSessionId: reference },
    { reference, successUrl, cancelUrl, sessionCreatedAt: new Date().toISOString() },
  );

  return {
    gateway: selected,
    orderId: order.id,
    reference,
    mode: 'redirect',
    redirectUrl: `${appUrl}/checkout/mock-gateway/${selected}?orderId=${order.id}&reference=${reference}`,
    instructions: `${gatewayLabels[selected] || selected} test checkout session created.`,
    payload: {
      amount: Number(order.total),
      currency: order.currency,
      invoiceNumber: order.invoiceNumber,
      successUrl,
      cancelUrl,
      items: order.items.map((item) => ({ title: item.title, price: Number(item.price) })),
    },
  };
}

export async function recordWebhook(provider: string, payload: any, eventId?: string, processed = false) {
  if (eventId) {
    const existing = await prisma.webhookEvent.findFirst({ where: { provider, eventId } }).catch(() => null);
    if (existing) return existing;
  }
  return prisma.webhookEvent.create({ data: { provider, eventId, payload: toJson(payload), processed } });
}
