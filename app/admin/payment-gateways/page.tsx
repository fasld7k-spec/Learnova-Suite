import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { INLINE_NATIVE_GATEWAYS, NATIVE_REDIRECT_GATEWAYS, SUPPORTED_GATEWAYS, gatewayLabels } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

const liveEnvByGateway: Record<string, string[]> = {
  stripe: ['STRIPE_SECRET_KEY'],
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  razorpay: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  paystack: ['PAYSTACK_SECRET_KEY'],
  flutterwave: ['FLUTTERWAVE_SECRET_KEY'],
  mollie: ['MOLLIE_API_KEY'],
  iyzico: ['IYZICO_API_KEY', 'IYZICO_SECRET_KEY'],
  paymob: ['PAYMOB_API_KEY'],
  tap: ['TAP_SECRET_KEY'],
  hyperpay: ['HYPERPAY_ACCESS_TOKEN'],
  midtrans: ['MIDTRANS_SERVER_KEY'],
  xendit: ['XENDIT_SECRET_KEY', 'XENDIT_WEBHOOK_TOKEN'],
  sslcommerz: ['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD'],
  manual: [],
  bank_transfer: [],
  cod: [],
};

const webhookEnvByGateway: Record<string, string[]> = {
  stripe: ['STRIPE_WEBHOOK_SECRET'],
  paypal: ['PAYPAL_WEBHOOK_ID', 'PAYPAL_PUBLIC_CERT'],
  razorpay: ['RAZORPAY_WEBHOOK_SECRET'],
  paystack: ['PAYSTACK_SECRET_KEY'],
  flutterwave: ['FLUTTERWAVE_SECRET_HASH'],
  iyzico: ['IYZICO_SECRET_KEY'],
  paymob: ['PAYMOB_HMAC_SECRET'],
  tap: ['TAP_SECRET_KEY'],
  hyperpay: ['HYPERPAY_ACCESS_TOKEN'],
  midtrans: ['MIDTRANS_SERVER_KEY'],
  xendit: ['XENDIT_WEBHOOK_TOKEN'],
  sslcommerz: ['SSLCOMMERZ_STORE_PASSWORD'],
};

const secretFields = [
  ['secretKey', 'Secret / API key'],
  ['clientSecret', 'Client secret'],
  ['webhookSecret', 'Webhook secret'],
  ['keySecret', 'Key secret'],
  ['hmacSecret', 'HMAC secret'],
  ['serverKey', 'Server key'],
  ['storePassword', 'Store password'],
  ['paymobApiKey', 'Paymob API key'],
  ['publicCert', 'PayPal public certificate'],
] as const;

const plainFields = [
  ['publicKey', 'Publishable key / public key'],
  ['accountId', 'Account / client / store ID'],
  ['webhookLabel', 'Webhook ID / label'],
  ['baseUrl', 'API base URL'],
  ['keyId', 'Key ID'],
  ['integrationId', 'Integration ID'],
  ['iframeId', 'Iframe ID'],
  ['clientKey', 'Client key'],
  ['storeId', 'Store ID'],
  ['entityId', 'Entity ID'],
  ['merchantId', 'Merchant ID'],
  ['terminalId', 'Terminal ID'],
  ['currency', 'Default currency'],
  ['country', 'Country code'],
] as const;

const nativeRedirectGateways = new Set<string>(NATIVE_REDIRECT_GATEWAYS);
const inlineNativeGateways = new Set<string>(INLINE_NATIVE_GATEWAYS);

function hasValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function hasAny(config: Record<string, unknown>, keys: readonly string[]) {
  return keys.some((key) => hasValue(config[key]));
}

function configWebhookSecret(config: Record<string, unknown>) {
  return hasAny(config, ['webhookSecret', 'webhookSigningSecret', 'signingSecret', 'webhookToken', 'endpointSecret', 'hmacSecret', 'publicCert']);
}

function hasWebhookSecret(slug: string, config: Record<string, unknown>) {
  const envKeys = webhookEnvByGateway[slug] || [`${slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_WEBHOOK_SECRET`];
  return configWebhookSecret(config) || envKeys.some((key) => Boolean(process.env[key])) || Boolean(process.env.WEBHOOK_SECRET);
}

function hasAdminCredentials(slug: string, config: Record<string, unknown>) {
  if (slug === 'paypal') {
    return (
      (hasValue(config.accountId) || hasValue(config.publicKey)) &&
      (hasValue(config.clientSecret) || hasValue(config.secretKey) || hasValue(config.apiKey))
    );
  }
  if (slug === 'razorpay') return hasAny(config, ['keyId', 'publicKey', 'accountId']) && hasAny(config, ['keySecret', 'secretKey', 'apiKey']);
  if (slug === 'paymob') return hasAny(config, ['paymobApiKey', 'secretKey', 'apiKey']) && hasAny(config, ['integrationId', 'iframeId']);
  if (slug === 'midtrans') return hasAny(config, ['serverKey', 'secretKey', 'apiKey']);
  if (slug === 'sslcommerz') return hasAny(config, ['storeId', 'accountId', 'publicKey']) && hasAny(config, ['storePassword', 'clientSecret', 'secretKey']);
  return hasAny(config, ['secretKey', 'clientSecret', 'apiKey', 'serverKey', 'paymobApiKey']);
}

function readiness(slug: string, config: Record<string, unknown>) {
  if (['manual', 'bank_transfer', 'cod'].includes(slug)) return 'Offline ready';
  const nativeGateway = ['stripe', 'paypal'].includes(slug) || nativeRedirectGateways.has(slug);
  const inlineGateway = inlineNativeGateways.has(slug);
  const hasHostedCheckout = hasValue(config.checkoutUrl) && !nativeGateway;
  if (inlineGateway && hasHostedCheckout) return 'Hosted checkout ready';
  if (hasHostedCheckout) return 'Hosted checkout ready';
  const required = liveEnvByGateway[slug] || [];
  const liveCredentialsReady = required.length
    ? required.every((key) => Boolean(process.env[key])) || hasAdminCredentials(slug, config)
    : hasAdminCredentials(slug, config);
  const needsWebhookSecret = nativeGateway || inlineGateway;
  const webhookReady = !needsWebhookSecret || hasWebhookSecret(slug, config);
  if (nativeGateway && liveCredentialsReady && webhookReady) return 'Native live ready';
  if (nativeGateway && liveCredentialsReady && !webhookReady) return 'Webhook secret pending';
  if (inlineGateway && liveCredentialsReady) return 'Inline live ready';
  if (!nativeGateway && liveCredentialsReady) return 'Hosted checkout URL pending';
  if (liveCredentialsReady && webhookReady) return 'Live ready';
  if (liveCredentialsReady && !webhookReady) return 'Webhook secret pending';
  if (hasAdminCredentials(slug, config)) return 'Admin keys saved';
  if (config.mode === 'live') return 'Live credentials missing';
  return 'Sandbox/mock ready';
}

function webhookStatus(slug: string, config: Record<string, unknown>) {
  if (['manual', 'bank_transfer', 'cod'].includes(slug)) return 'Manual review';
  if (hasValue(config.checkoutUrl) && !['stripe', 'paypal'].includes(slug)) return 'Hosted redirect';
  return hasWebhookSecret(slug, config) ? 'Secret configured' : 'Secret pending';
}

function modeCopy(slug: string, mode: string, state: string) {
  if (['manual', 'bank_transfer', 'cod'].includes(slug)) return 'Offline/manual collection. No automated capture or refund is attempted.';
  if (mode === 'live' && /missing|pending/i.test(state)) return 'Live mode is selected, but production credentials are missing or incomplete.';
  if (mode === 'live') return 'Live credentials are present; verify provider sandbox/live settings before accepting real money.';
  return 'Sandbox/mock checkout is for testing only and does not prove production provider credentials.';
}

function secretState(config: Record<string, unknown>, key: string) {
  return hasValue(config[key]) ? 'Saved - leave blank to keep' : 'Not saved';
}

export default async function PaymentGateways() {
  await requireUser(['ADMIN']);
  const [rows, settings] = await Promise.all([
    prisma.paymentMethod.findMany({ orderBy: { slug: 'asc' } }),
    getSiteSettings()
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const gateways = SUPPORTED_GATEWAYS
    .filter((gateway) => gateway !== 'free')
    .map((slug) => {
      const row = rowBySlug.get(slug);
      return {
        id: row?.id || slug,
        slug,
        name: row?.name || gatewayLabels[slug] || slug,
        active: Boolean(row?.active),
        instructions: row?.instructions || '',
        configured: Boolean(row),
        config: fromJsonObject<Record<string, unknown>>(row?.config),
      };
    });
  const configuredCount = gateways.filter((row) => row.configured).length;
  const activeCount = gateways.filter((row) => row.active).length;
  const sandboxMode = process.env.PAYMENT_SANDBOX_MODE === 'true' || process.env.NODE_ENV !== 'production';

  return (
    <DashboardShell role="admin" title="Payment Gateways">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{configuredCount}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">{t('Configured gateways')}</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{activeCount}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">{t('Active checkout options')}</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{sandboxMode ? t('On') : t('Off')}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">{t('Sandbox/mock mode')}</p>
        </div>
      </div>

      <section className="mt-6 border border-[#2F3336] bg-black p-5">
        <h2 className="text-xl font-black">{t('Gateway Control Center')}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#71767B]">
          {t('Enable checkout methods, save live or sandbox credentials, configure hosted checkout URLs, and keep webhook secrets encrypted from this page. Sandbox/mock methods are test surfaces only; live checkout still requires real provider credentials. Blank secret fields keep the saved value.')}
        </p>
      </section>

      <div className="mt-6 grid gap-4">
        {gateways.map((row) => {
          const state = readiness(row.slug, row.config);
          const mode = String(row.config.mode || (['manual', 'bank_transfer', 'cod'].includes(row.slug) ? 'offline' : 'sandbox'));
          const liveEnv = liveEnvByGateway[row.slug] || [];
          const nativeGateway = ['stripe', 'paypal'].includes(row.slug) || nativeRedirectGateways.has(row.slug);
          const inlineGateway = inlineNativeGateways.has(row.slug);
          const hasHostedCheckout = hasValue(row.config.checkoutUrl) && !nativeGateway;
          const readyTone = state === 'Live credentials missing' || state === 'Webhook secret pending' || state === 'Hosted checkout URL pending' ? 'yellow' : 'green';

          return (
            <section id={row.slug} key={row.slug} className="border border-[#2F3336] bg-black p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-white">{row.name}</h2>
                    <code className="rounded-full border border-[#2F3336] px-3 py-1 text-xs font-bold text-[#1D9BF0]">{row.slug}</code>
                    <Badge tone={row.active ? 'green' : 'red'}>{row.active ? t('Active') : t('Disabled')}</Badge>
                    <Badge tone={row.configured ? 'green' : 'yellow'}>{row.configured ? t('Configured') : t('Not configured')}</Badge>
                    <Badge tone={readyTone}>{t(state)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-[#71767B] md:grid-cols-2">
                    <p>{t('Webhook')}: {t(webhookStatus(row.slug, row.config))}</p>
                    <p>{t('Mode')}: {mode}</p>
                    <p>{t('Production credentials')}: {hasHostedCheckout ? 'Hosted checkout URL' : liveEnv.length ? liveEnv.join(', ') : t('Not required')}</p>
                    <p>{t('Webhook URL')}: <code className="text-white">/api/webhooks/{row.slug}</code></p>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#71767B]">{t(modeCopy(row.slug, mode, state))}</p>
                  {inlineGateway && (
                    <p className="mt-2 text-xs text-[#71767B]">{t('Use hosted checkout URL or custom inline checkout surface for production.')}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <form action="/api/admin/payment-gateways" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="toggle" />
                    <input type="hidden" name="slug" value={row.slug} />
                    <button className="btn-secondary">{row.active ? t('Disable') : t('Enable')}</button>
                  </form>
                  {row.configured && (
                    <form action="/api/admin/payment-gateways" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="slug" value={row.slug} />
                      <button className="btn-secondary border-yellow-400/40 text-yellow-100">{t('Reset saved config')}</button>
                    </form>
                  )}
                </div>
              </div>

              <form className="mt-5 grid gap-4" action="/api/admin/payment-gateways" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="upsert" />
                <input type="hidden" name="slug" value={row.slug} />
                <div className="grid gap-3 md:grid-cols-4">
                  <input className="input" name="name" defaultValue={row.name} placeholder={t('Display name')} />
                  <select className="input" name="mode" defaultValue={mode}>
                    <option value="sandbox">{t('Test mode')}</option>
                    <option value="live">{t('Live')}</option>
                    <option value="offline">{t('Offline')}</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                    <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked={row.active} /> {t('Active at checkout')}
                  </label>
                  <button className="btn-primary w-fit">{t('Save Gateway')}</button>
                </div>
                <p className="text-xs font-semibold text-[#71767B]">{t('Active sandbox/mock gateways appear at checkout for testing. Production payment collection requires live credentials or a hosted checkout URL.')}</p>

                <textarea className="input min-h-24" name="instructions" defaultValue={row.instructions} placeholder={t('Customer instructions')} />

                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input" name="checkoutUrl" defaultValue={String(row.config.checkoutUrl || '')} placeholder={t('Hosted checkout URL with {{orderId}}, {{amount}}, {{successUrl}}')} />
                  <input className="input" name="checkoutInstructions" defaultValue={String(row.config.checkoutInstructions || '')} placeholder={t('Hosted checkout note for admins/customers')} />
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-normal text-[#71767B]">{t('Public settings')}</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {plainFields.map(([key, label]) => (
                      <label key={key} className="grid gap-1">
                        <span className="text-xs font-bold text-[#71767B]">{t(label)}</span>
                        <input className="input" name={key} defaultValue={String(row.config[key] || '')} />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-normal text-[#71767B]">{t('Encrypted secrets')}</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {secretFields.map(([key, label]) => (
                      <label key={key} className="grid gap-1">
                        <span className="text-xs font-bold text-[#71767B]">{t(label)}</span>
                        <input className="input" name={key} type="password" autoComplete="new-password" placeholder={t(secretState(row.config, key))} />
                        <span className="flex items-center gap-2 text-xs font-semibold text-[#71767B]">
                          <input className="accent-[#1D9BF0]" type="checkbox" name={`clear_${key}`} /> {t('Clear saved value')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </form>
            </section>
          );
        })}
      </div>
    </DashboardShell>
  );
}
