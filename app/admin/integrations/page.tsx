import { Activity, KeyRound, PlugZap, RadioTower, Settings2 } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

const integrationCatalog = [
  {
    provider: 'google_analytics',
    label: 'Google Analytics',
    trackingKeys: ['trackingId', 'propertyId', 'measurementId'],
    requiredTrackingKeys: ['measurementId'],
    webhook: false,
    secret: false,
    help: 'Use Measurement ID for GA4, for example G-XXXXXXXXXX.',
  },
  {
    provider: 'facebook_pixel',
    label: 'Meta Pixel',
    trackingKeys: ['trackingId', 'pixelId'],
    requiredTrackingKeys: ['pixelId'],
    webhook: false,
    secret: false,
    help: 'Paste the Pixel ID from Meta Events Manager.',
  },
  { provider: 'zapier', label: 'Zapier', trackingKeys: [], requiredTrackingKeys: [], webhook: true, secret: false, help: 'Paste the Zapier catch-hook URL.' },
  {
    provider: 'mailchimp',
    label: 'Mailchimp',
    trackingKeys: ['audienceId'],
    requiredTrackingKeys: ['audienceId'],
    webhook: false,
    secret: true,
    secretLabel: 'Mailchimp API key',
    help: 'Sync paid learners to a Mailchimp audience when orders are completed. API keys usually end with the data center, for example -us21.',
  },
  { provider: 'slack', label: 'Slack', trackingKeys: ['channel'], requiredTrackingKeys: ['channel'], webhook: true, secret: false, help: 'Use a channel name plus incoming webhook URL.' },
  {
    provider: 'zoom',
    label: 'Zoom Server-to-Server OAuth',
    trackingKeys: ['accountId', 'clientId', 'userId', 'timezone'],
    requiredTrackingKeys: ['accountId', 'clientId'],
    webhook: false,
    secret: true,
    secretLabel: 'Client secret',
    help: 'Required for automatic live-class links: Zoom account ID, client ID, and client secret. User ID defaults to me and timezone defaults to UTC.',
  },
  {
    provider: 'google_meet',
    label: 'Google Meet Calendar API',
    trackingKeys: ['clientId', 'calendarId', 'timezone'],
    requiredTrackingKeys: [],
    webhook: false,
    secret: true,
    secretLabel: 'OAuth access token',
    extraSecrets: [
      { key: 'clientSecret', label: 'OAuth client secret', clearKey: 'clearClientSecret' },
      { key: 'refreshToken', label: 'OAuth refresh token', clearKey: 'clearRefreshToken' },
    ],
    help: 'Required for automatic Google Meet links: either an access token, or client ID + client secret + refresh token for automatic token refresh. Calendar ID defaults to primary and timezone defaults to UTC.',
  },
];

function hasValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function hasAny(config: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => hasValue(config[key]));
}

function hasAll(config: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => hasValue(config[key]));
}

function hasWebhookConfig(config: Record<string, unknown>) {
  return hasAny(config, ['webhookUrl', 'webhookSecret', 'webhookSigningSecret', 'signingSecret', 'endpointSecret']);
}

function hasSecretConfig(config: Record<string, unknown>) {
  return hasAny(config, ['apiKey', 'secretKey', 'clientSecret', 'accessToken', 'refreshToken']);
}

function primarySecretSaved(config: Record<string, unknown>, item: (typeof integrationCatalog)[number]) {
  if (item.provider === 'google_meet') {
    return hasAny(config, ['accessToken', 'apiKey', 'secretKey']) || (hasAny(config, ['clientSecret']) && hasAny(config, ['refreshToken']));
  }
  return hasSecretConfig(config);
}

function readiness(config: Record<string, unknown>, item: (typeof integrationCatalog)[number]) {
  if (item.requiredTrackingKeys.length && !hasAll(config, item.requiredTrackingKeys)) return 'Required fields pending';
  if (item.webhook && !hasWebhookConfig(config)) return 'Webhook pending';
  if (item.secret && !primarySecretSaved(config, item)) return 'API key pending';
  if (item.secret && primarySecretSaved(config, item)) return 'Key saved';
  if (item.webhook && hasWebhookConfig(config)) return 'Webhook saved';
  if (item.trackingKeys.length && hasAny(config, item.trackingKeys)) return 'Tracking saved';
  if (Object.keys(config).length > 0) return 'Config saved';
  return 'Needs config';
}

function readinessTone(state: string) {
  return state.includes('pending') || state === 'Needs config' ? 'yellow' : 'green';
}

function savedStatus(saved: boolean, label: string, pendingLabel = 'Pending') {
  return <Badge tone={saved ? 'green' : 'yellow'}>{saved ? label : pendingLabel}</Badge>;
}

function keyLabel(key: string) {
  const labels: Record<string, string> = {
    accountId: 'Account ID',
    clientId: 'Client ID',
    userId: 'User ID',
    timezone: 'Timezone',
    calendarId: 'Calendar ID',
    audienceId: 'Audience ID',
    measurementId: 'Measurement ID',
    pixelId: 'Pixel ID',
    propertyId: 'Property ID',
    trackingId: 'Tracking ID',
    channel: 'Channel',
  };
  return labels[key] || key;
}

function keyPlaceholder(key: string) {
  const placeholders: Record<string, string> = {
    accountId: 'Zoom account ID',
    clientId: 'OAuth client ID',
    userId: 'me',
    timezone: 'Africa/Cairo',
    calendarId: 'primary',
    audienceId: 'Mailchimp audience ID',
    measurementId: 'G-XXXXXXXXXX',
    pixelId: 'Meta pixel ID',
    propertyId: 'GA4 property ID',
    trackingId: 'Tracking ID',
    channel: '#sales',
  };
  return placeholders[key] || key;
}

export default async function Integrations() {
  await requireUser(['ADMIN']);
  const rows = await prisma.integrationSetting.findMany({ orderBy: { provider: 'asc' } });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  const catalogRows = integrationCatalog.map((item) => ({ ...item, setting: byProvider.get(item.provider) }));
  const activeCount = rows.filter((row) => row.active).length;
  const configuredCount = rows.filter((row) => {
    const config = fromJsonObject(row.config);
    return hasAny(config, ['trackingId', 'propertyId', 'measurementId', 'pixelId', 'audienceId', 'channel']) || hasWebhookConfig(config) || hasSecretConfig(config);
  }).length;
  const stats = [
    { label: 'Supported integrations', value: integrationCatalog.length, icon: PlugZap, tone: 'text-[#79C7FF]' },
    { label: 'Active integrations', value: activeCount, icon: Activity, tone: 'text-[#5EE4B3]' },
    { label: 'Readiness signals', value: configuredCount, icon: Settings2, tone: 'text-[#FFE36E]' }
  ];

  return (
    <DashboardShell role="admin" title="Integrations">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="ui-panel p-5" key={stat.label}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-3xl font-black text-white">{stat.value}</div>
                  <p className="mt-1 text-sm font-semibold text-[#8A949E]">{stat.label}</p>
                </div>
                <Icon className={stat.tone} size={22} strokeWidth={1.8} />
              </div>
            </div>
          );
        })}
      </div>

      <form className="ui-panel mt-6 grid gap-4 p-5" action="/api/admin/integrations" method="post">
        <CsrfInput />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[#79C7FF]">Connection setup</p>
            <h2 className="mt-1 text-xl font-black text-white">Save external service credentials</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8A949E]">
              Store tracking IDs, webhook URLs, live-class provider credentials, and optional secrets without exposing saved credentials in the readiness table.
            </p>
          </div>
          <div className="ui-panel-muted flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#D7DEE4]">
            <RadioTower size={16} strokeWidth={1.8} />
            docs/INTEGRATIONS.md
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
            Provider
            <select className="input" name="provider">
              {integrationCatalog.map((integration) => (
                <option key={integration.provider} value={integration.provider}>{integration.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
            Mode
            <select className="input" name="mode" defaultValue="test">
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label className="flex items-center gap-3 self-end text-sm font-bold text-[#D7DEE4]">
            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked />
            Active
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
            Tracking ID or key
            <input className="input" name="trackingId" placeholder="G-XXXXXXXXXX" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
            Webhook URL
            <input className="input" name="webhookUrl" placeholder="https://hooks.example.com/learnova" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
            Secret/API key
            <span className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A949E]" size={16} strokeWidth={1.8} />
              <input className="input pl-10" name="apiKey" type="password" autoComplete="new-password" placeholder="Saved if filled" />
            </span>
          </label>
        </div>
        <button className="btn-primary w-fit">Save Integration</button>
      </form>

      <section className="ui-panel mt-6 p-5">
        <h2 className="text-xl font-black">External Integration Readiness</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8A949E]">
          Saved tracking IDs, webhook URLs, and secret keys are summarized here without exposing sensitive values.
        </p>
      </section>

      <div className="mt-6">
        <DataTable
          headers={['Provider', 'Status', 'Readiness', 'Mode', 'Tracking', 'Webhook', 'Secret/API Key', 'Updated', 'Admin Control']}
          rows={catalogRows.map((item) => {
            const setting = item.setting;
            const config = fromJsonObject(setting?.config);
            const state = readiness(config, item);
            const trackingSaved = hasAny(config, item.trackingKeys);
            const webhookSaved = hasWebhookConfig(config);
            const secretSaved = primarySecretSaved(config, item);
            return [
              <div key="provider" className="min-w-[220px]">
                <div className="font-black text-white">{item.label}</div>
                <p className="mt-1 text-xs leading-5 text-[#8A949E]">{item.help}</p>
              </div>,
              <Badge key="active" tone={setting?.active ? 'green' : 'red'}>{setting?.active ? 'Active' : 'Disabled'}</Badge>,
              <Badge key="ready" tone={readinessTone(state)}>{state}</Badge>,
              String(config.mode || 'test'),
              item.trackingKeys.length ? (
                <div key="tracking" className="grid gap-1">
                  {savedStatus(item.requiredTrackingKeys.length ? hasAll(config, item.requiredTrackingKeys) : trackingSaved, 'Ready')}
                  <span className="text-xs text-[#8A949E]">
                    Required: {item.requiredTrackingKeys.length ? item.requiredTrackingKeys.map(keyLabel).join(', ') : 'Optional'}
                  </span>
                </div>
              ) : 'Not required',
              item.webhook ? (
                <div key="hook" className="grid gap-1">
                  {savedStatus(webhookSaved, 'Saved')}
                  <code className="text-xs text-white">/api/webhooks/{item.provider}</code>
                </div>
              ) : 'Client script',
              item.secret ? savedStatus(secretSaved, 'Saved') : (secretSaved ? savedStatus(true, 'Saved') : 'Optional'),
              setting?.updatedAt.toISOString().slice(0, 10) || '-',
              <div key="manage" className="grid min-w-[460px] gap-3">
                <form className="grid gap-3" action="/api/admin/integrations" method="post">
                  <CsrfInput />
                  <input type="hidden" name="_action" value="update" />
                  <input type="hidden" name="provider" value={item.provider} />
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="text-xs font-bold text-[#D7DEE4]">
                      Mode
                      <select className="input mt-1" name="mode" defaultValue={String(config.mode || 'test')}>
                        <option value="test">Test</option>
                        <option value="live">Live</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 self-end text-xs font-bold text-[#D7DEE4]">
                      <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked={setting?.active ?? false} />
                      Active
                    </label>
                  </div>
                  {item.trackingKeys.length ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {item.trackingKeys.map((key) => (
                        <label key={key} className="text-xs font-bold text-[#D7DEE4]">
                          {keyLabel(key)} {(item.requiredTrackingKeys as string[]).includes(key) ? <span className="text-[#79C7FF]">*</span> : <span className="text-[#8A949E]">(optional)</span>}
                          <input className="input mt-1" name={key} defaultValue={String(config[key] || '')} placeholder={keyPlaceholder(key)} />
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {item.webhook ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="text-xs font-bold text-[#D7DEE4]">
                        Webhook URL
                        <input className="input mt-1" name="webhookUrl" defaultValue={String(config.webhookUrl || '')} placeholder="https://hooks.example.com/endpoint" />
                      </label>
                      <label className="text-xs font-bold text-[#D7DEE4]">
                        Webhook secret
                        <input className="input mt-1" name="webhookSecret" type="password" autoComplete="new-password" placeholder={config.webhookSecret ? 'Saved - leave blank to keep' : 'Optional signing secret'} />
                      </label>
                    </div>
                  ) : null}
                  {item.secret ? (
                    <div className="grid gap-2">
                      <label className="text-xs font-bold text-[#D7DEE4]">
                        {item.secretLabel || 'API key / access token'}
                        <input className="input mt-1" name="apiKey" type="password" autoComplete="new-password" placeholder={secretSaved ? 'Saved - leave blank to keep' : item.secretLabel || 'Provider secret'} />
                      </label>
                      {'extraSecrets' in item && item.extraSecrets?.length ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          {item.extraSecrets.map((field) => (
                            <label key={field.key} className="text-xs font-bold text-[#D7DEE4]">
                              {field.label}
                              <input className="input mt-1" name={field.key} type="password" autoComplete="new-password" placeholder={hasValue(config[field.key]) ? 'Saved - leave blank to keep' : field.label} />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#D7DEE4]">
                    {item.webhook ? (
                      <label className="flex items-center gap-2">
                        <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="clearWebhookSecret" />
                        Clear webhook secret
                      </label>
                    ) : null}
                    {item.secret ? (
                      <>
                        <label className="flex items-center gap-2">
                          <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="clearApiKey" />
                          Clear API key
                        </label>
                        {'extraSecrets' in item && item.extraSecrets?.map((field) => (
                          <label key={field.clearKey} className="flex items-center gap-2">
                            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name={field.clearKey} />
                            Clear {field.label}
                          </label>
                        ))}
                      </>
                    ) : null}
                    <button className="btn-primary">Save {item.label}</button>
                  </div>
                </form>
                {setting ? (
                  <form action="/api/admin/integrations" method="post">
                    <CsrfInput />
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="provider" value={item.provider} />
                    <button className="btn-secondary border-red-400/40 text-red-200">Reset integration</button>
                  </form>
                ) : null}
              </div>,
            ];
          })}
        />
      </div>
    </DashboardShell>
  );
}
