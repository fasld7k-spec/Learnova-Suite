import { AlertTriangle, CheckCircle2, ClipboardCheck, CreditCard, KeyRound, RadioTower, ReceiptText, ShieldCheck, type LucideIcon } from 'lucide-react';

import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { gatewayLabels, getActivePaymentMethods, INLINE_NATIVE_GATEWAYS, NATIVE_REDIRECT_GATEWAYS, SUPPORTED_GATEWAYS } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

const liveEnvByGateway: Record<string, string[]> = {
  stripe: ['STRIPE_SECRET_KEY'],
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  razorpay: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  paystack: ['PAYSTACK_SECRET_KEY'],
  flutterwave: ['FLUTTERWAVE_SECRET_KEY'],
  mollie: ['MOLLIE_API_KEY'],
  iyzico: ['IYZICO_API_KEY', 'IYZICO_SECRET_KEY'],
  paymob: ['PAYMOB_API_KEY', 'PAYMOB_INTEGRATION_ID'],
  tap: ['TAP_SECRET_KEY'],
  hyperpay: ['HYPERPAY_ACCESS_TOKEN', 'HYPERPAY_ENTITY_ID'],
  midtrans: ['MIDTRANS_SERVER_KEY'],
  xendit: ['XENDIT_SECRET_KEY'],
  sslcommerz: ['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD'],
  manual: [],
  bank_transfer: [],
  cod: [],
};

const secretLikeFields = [
  'secretKey',
  'apiKey',
  'clientSecret',
  'webhookSecret',
  'webhookToken',
  'signingSecret',
  'keySecret',
  'hmacSecret',
  'serverKey',
  'storePassword',
  'paymobApiKey',
  'publicCert',
];

const publicCredentialFields = [
  'publicKey',
  'accountId',
  'keyId',
  'integrationId',
  'iframeId',
  'clientKey',
  'storeId',
  'entityId',
  'merchantId',
  'terminalId',
];

const nativeGateways = new Set<string>(['stripe', 'paypal', ...NATIVE_REDIRECT_GATEWAYS]);
const inlineGateways = new Set<string>(INLINE_NATIVE_GATEWAYS);

function hasValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function hasAny(config: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => hasValue(config[key]));
}

function hasCredentialSet(slug: string, config: Record<string, unknown>) {
  if (['manual', 'bank_transfer', 'cod'].includes(slug)) return true;
  if (slug === 'paypal') return hasAny(config, ['accountId', 'publicKey']) && hasAny(config, ['clientSecret', 'secretKey', 'apiKey']);
  if (slug === 'razorpay') return hasAny(config, ['keyId', 'publicKey', 'accountId']) && hasAny(config, ['keySecret', 'secretKey', 'apiKey']);
  if (slug === 'paymob') return hasAny(config, ['paymobApiKey', 'secretKey', 'apiKey']) && hasAny(config, ['integrationId', 'iframeId']);
  if (slug === 'sslcommerz') return hasAny(config, ['storeId', 'accountId', 'publicKey']) && hasAny(config, ['storePassword', 'clientSecret', 'secretKey']);
  return hasAny(config, secretLikeFields) || hasAny(config, publicCredentialFields);
}

function hasWebhookSecret(slug: string, config: Record<string, unknown>) {
  if (['manual', 'bank_transfer', 'cod'].includes(slug)) return true;
  return hasAny(config, ['webhookSecret', 'webhookToken', 'signingSecret', 'hmacSecret', 'publicCert']) || Boolean(process.env.WEBHOOK_SECRET);
}

function gatewayReadiness(slug: string, config: Record<string, unknown>, active: boolean) {
  const mode = String(config.mode || (['manual', 'bank_transfer', 'cod'].includes(slug) ? 'offline' : 'sandbox'));
  const hosted = hasValue(config.checkoutUrl) && !nativeGateways.has(slug);
  const credentials = hasCredentialSet(slug, config);
  const webhook = hasWebhookSecret(slug, config);
  const liveEnv = liveEnvByGateway[slug] || [];
  const envReady = liveEnv.length === 0 || liveEnv.every((key) => Boolean(process.env[key]));

  if (!active) return { label: 'Disabled', tone: 'slate' as const, mode, details: 'Not visible at checkout.' };
  if (['manual', 'bank_transfer', 'cod'].includes(slug)) return { label: 'Offline ready', tone: 'green' as const, mode, details: 'Manual approval flow is available.' };
  if (process.env.PAYMENT_SANDBOX_MODE === 'true' || process.env.NODE_ENV !== 'production') return { label: 'Sandbox ready', tone: 'blue' as const, mode, details: 'Safe test checkout redirects are enabled.' };
  if (hosted) return { label: 'Hosted ready', tone: 'green' as const, mode, details: 'Hosted checkout URL is configured.' };
  if (nativeGateways.has(slug) && (credentials || envReady) && webhook) return { label: 'Live ready', tone: 'green' as const, mode, details: 'Credentials and webhook secret are available.' };
  if (inlineGateways.has(slug) && credentials) return { label: 'Inline needs QA', tone: 'yellow' as const, mode, details: 'Credentials exist; verify the inline checkout surface.' };
  if (credentials && !webhook) return { label: 'Webhook missing', tone: 'yellow' as const, mode, details: 'Add webhook secret before live traffic.' };
  return { label: 'Credentials missing', tone: 'red' as const, mode, details: 'Add live credentials or hosted checkout URL.' };
}

function orderTone(status?: string | null) {
  if (status === 'PAID' || status === 'SUCCESS') return 'green' as const;
  if (status === 'FAILED' || status === 'CANCELLED') return 'red' as const;
  return 'yellow' as const;
}

const verificationCards: { title: string; body: string; icon: LucideIcon }[] = [
  { title: 'Gateway credentials', body: 'Save sandbox or live keys for every enabled provider.', icon: KeyRound },
  { title: 'Webhook forwarding', body: 'Forward provider events to /api/webhooks/{gateway}.', icon: RadioTower },
  { title: 'Order lifecycle', body: 'Confirm paid status, enrollment, invoice, email and notification.', icon: ClipboardCheck },
  { title: 'Signature validation', body: 'Send valid and tampered payloads before production traffic.', icon: ShieldCheck },
];

export default async function PaymentTest() {
  await requireUser(['ADMIN']);

  const [configuredMethods, activeMethods, endpoints, webhookEvents, deliveries, orders, courses, settings] = await Promise.all([
    prisma.paymentMethod.findMany({ orderBy: { slug: 'asc' } }),
    getActivePaymentMethods(),
    prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.webhookEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.webhookDelivery.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.order.findMany({ include: { items: true, payment: true }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, price: true, salePrice: true, isFree: true },
    }),
    getSiteSettings(),
  ]);

  const activeSlugs = new Set(activeMethods.map((method: any) => method.slug));
  const configuredBySlug = new Map(configuredMethods.map((method) => [method.slug, method]));
  const gatewayRows = SUPPORTED_GATEWAYS
    .filter((slug) => slug !== 'free')
    .map((slug) => {
      const method = configuredBySlug.get(slug);
      const config = fromJsonObject<Record<string, unknown>>(method?.config);
      const active = activeSlugs.has(slug);
      return {
        slug,
        name: method?.name || gatewayLabels[slug] || slug,
        active,
        configured: Boolean(method),
        config,
        readiness: gatewayReadiness(slug, config, active),
      };
    });

  const activeGatewayCount = gatewayRows.filter((row) => row.active).length;
  const liveReadyCount = gatewayRows.filter((row) => ['Offline ready', 'Sandbox ready', 'Hosted ready', 'Live ready'].includes(row.readiness.label)).length;
  const paymentExceptions = orders.filter((order) => order.status === 'FAILED' || order.payment?.status === 'FAILED').length;
  const pendingOrders = orders.filter((order) => order.status === 'PENDING').length;
  const activeEndpoints = endpoints.filter((endpoint) => endpoint.active).length;
  const signedEndpoints = endpoints.filter((endpoint) => endpoint.secret).length;
  const failedDeliveries = deliveries.filter((delivery) => delivery.status !== 'SUCCESS').length;
  const sandboxMode = process.env.PAYMENT_SANDBOX_MODE === 'true' || process.env.NODE_ENV !== 'production';
  const testableCourse = courses.find((course) => !course.isFree && Number(course.salePrice ?? course.price ?? 0) > 0) || courses[0];
  const defaultGateway = activeMethods[0]?.slug || 'manual';

  const readinessAlerts = [
    activeGatewayCount === 0 ? 'No active checkout method is enabled.' : '',
    !sandboxMode && gatewayRows.some((row) => row.active && row.readiness.tone === 'red') ? 'One or more active live gateways still need credentials.' : '',
    endpoints.length > 0 && signedEndpoints < endpoints.length ? 'Some webhook endpoints are unsigned. Add secrets for production integrations.' : '',
    paymentExceptions > 0 ? 'Recent payment exceptions exist. Review failed orders before publishing.' : '',
  ].filter(Boolean);

  return (
    <DashboardShell role="admin" title="Payment Testing">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active checkout" value={activeGatewayCount} icon={<CreditCard size={18} />} />
        <StatCard label="Ready methods" value={liveReadyCount} icon={<ShieldCheck size={18} />} />
        <StatCard label="Active webhooks" value={activeEndpoints} icon={<RadioTower size={18} />} />
        <StatCard label="Pending orders" value={pendingOrders} icon={<ReceiptText size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="ui-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2A3037] bg-[#101317] text-[#79C7FF]">
                <CheckCircle2 size={22} strokeWidth={1.8} />
              </div>
              <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#79C7FF]">Gateway verification</p>
              <h2 className="mt-2 text-2xl font-black leading-tight text-white">Run a real checkout test from admin</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8A949E]">
                This page reads the actual gateway registry, webhook endpoints, recent orders, and published courses so the buyer can verify checkout without touching code.
              </p>
            </div>
            <Badge tone={sandboxMode ? 'blue' : 'yellow'}>{sandboxMode ? 'Sandbox mode' : 'Live mode'}</Badge>
          </div>

          <form className="mt-6 grid gap-3 border-t border-[#2F3336] pt-5 md:grid-cols-[1fr_220px_auto]" action="/api/checkout" method="post">
            <CsrfInput />
            <select className="input" name="courseId" defaultValue={testableCourse?.id || ''} required>
              {courses.length === 0 ? <option value="">Publish a paid course first</option> : null}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} - {course.isFree ? 'Free' : formatMoney(course.salePrice ?? course.price, settings.currency)}
                </option>
              ))}
            </select>
            <select className="input" name="gateway" defaultValue={defaultGateway}>
              {activeMethods.map((method: any) => (
                <option key={method.slug} value={method.slug}>{method.name || gatewayLabels[method.slug] || method.slug}</option>
              ))}
            </select>
            <button className="btn-primary" disabled={!testableCourse || activeMethods.length === 0}>Start Test Checkout</button>
          </form>

          {readinessAlerts.length > 0 ? (
            <div className="mt-5 grid gap-2">
              {readinessAlerts.map((alert) => (
                <div key={alert} className="flex items-start gap-3 border border-[#FFD400]/40 bg-[#FFD400]/10 p-3 text-sm font-semibold text-[#FFE36E]">
                  <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3 border border-[#00BA7C]/40 bg-[#00BA7C]/10 p-3 text-sm font-semibold text-[#5EE4B3]">
              <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
              <span>Core payment readiness checks are clean for the currently configured mode.</span>
            </div>
          )}
        </div>

        <aside className="ui-panel-muted p-5">
          <p className="text-xs font-black uppercase tracking-wide text-[#8A949E]">Webhook forwarding</p>
          <pre className="mt-3 overflow-auto rounded-md border border-[#2A3037] bg-[#050608] p-4 text-xs leading-6 text-[#D7DEE4]">
            Stripe CLI: stripe listen --forward-to YOUR_APP_URL/api/webhooks/stripe
            {`\n\nSigned platform endpoints use x-learnova-signature = HMAC_SHA256(raw_json, endpoint_secret).`}
            {`\n\nProvider webhooks are available at /api/webhooks/{gateway}.`}
          </pre>
          <div className="mt-4 grid gap-2 text-sm text-[#D7DEE4]">
            <div className="flex justify-between gap-3"><span>Registered endpoints</span><Badge tone={endpoints.length ? 'green' : 'slate'}>{endpoints.length}</Badge></div>
            <div className="flex justify-between gap-3"><span>Signed endpoints</span><Badge tone={signedEndpoints === endpoints.length && endpoints.length ? 'green' : 'yellow'}>{signedEndpoints}/{endpoints.length}</Badge></div>
            <div className="flex justify-between gap-3"><span>Failed deliveries</span><Badge tone={failedDeliveries ? 'red' : 'green'}>{failedDeliveries}</Badge></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a className="btn-secondary" href="/admin/payment-gateways">Gateways</a>
            <a className="btn-secondary" href="/admin/webhook-endpoints">Webhooks</a>
            <a className="btn-secondary" href="/admin/orders">Orders</a>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-black text-white">Gateway Diagnostics</h2>
        <DataTable
          headers={['Gateway', 'Mode', 'Status', 'Credentials', 'Webhook', 'Manage']}
          rows={gatewayRows.map((row) => [
            <div key="gateway">
              <p className="font-black text-white">{row.name}</p>
              <code className="text-xs font-bold text-[#1D9BF0]">{row.slug}</code>
            </div>,
            row.readiness.mode,
            <div key="status" className="grid gap-1">
              <Badge tone={row.readiness.tone}>{row.readiness.label}</Badge>
              <span className="max-w-sm text-xs leading-5 text-[#71767B]">{row.readiness.details}</span>
            </div>,
            <Badge key="credentials" tone={hasCredentialSet(row.slug, row.config) ? 'green' : row.configured ? 'yellow' : 'slate'}>
              {hasCredentialSet(row.slug, row.config) ? 'Saved' : row.configured ? 'Partial' : 'Empty'}
            </Badge>,
            <Badge key="webhook" tone={hasWebhookSecret(row.slug, row.config) ? 'green' : 'yellow'}>
              {hasWebhookSecret(row.slug, row.config) ? 'Ready' : 'Missing'}
            </Badge>,
            <a key="manage" className="btn-secondary" href={`/admin/payment-gateways#${row.slug}`}>Configure</a>,
          ])}
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-black text-white">Recent Payment Orders</h2>
          <DataTable
            headers={['Invoice', 'Gateway', 'Total', 'Payment', 'Order']}
            rows={orders.map((order) => [
              <a key="invoice" className="font-black text-[#1D9BF0]" href={`/invoice?id=${order.id}`}>{order.invoiceNumber}</a>,
              order.gateway,
              formatMoney(order.total, order.currency),
              <Badge key="payment" tone={orderTone(order.payment?.status)}>{order.payment?.status || 'PENDING'}</Badge>,
              <Badge key="order" tone={orderTone(order.status)}>{order.status}</Badge>,
            ])}
          />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-black text-white">Recent Webhook Events</h2>
          <DataTable
            headers={['Provider', 'Event', 'Processed', 'Created']}
            rows={webhookEvents.map((event) => [
              <span key="provider" className="font-bold text-white">{event.provider}</span>,
              <code key="event" className="text-xs text-[#1D9BF0]">{event.eventId || 'no event id'}</code>,
              <Badge key="processed" tone={event.processed ? 'green' : 'yellow'}>{event.processed ? 'Processed' : 'Pending'}</Badge>,
              event.createdAt.toLocaleString(),
            ])}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {verificationCards.map(({ title, body, icon: Icon }) => (
          <article className="ui-panel p-5" key={title}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#2A3037] bg-[#101317] text-[#79C7FF]">
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-base font-black text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#8A949E]">{body}</p>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
