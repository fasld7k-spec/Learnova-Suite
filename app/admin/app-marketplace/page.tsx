import Link from 'next/link';
import { Boxes, CheckCircle2, PlugZap, UploadCloud } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import {
  addonCategory,
  addonExtensionPoints,
  addonExtensionSummary,
  addonSettingsSchema,
  addonVersion,
  defaultAddonCatalog,
  manifestFromConfig,
  type AddonSetting,
} from '@/lib/addons';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

function boolLabel(value: boolean) {
  return value ? 'Enabled' : 'Disabled';
}

function settingValue(config: Record<string, unknown>, field: AddonSetting) {
  const saved = config[field.key];
  if (field.secret) return '';
  if (typeof saved === 'string' || typeof saved === 'number') return String(saved);
  if (typeof saved === 'boolean') return saved;
  return field.defaultValue;
}

function SettingControl({ field, config }: { field: AddonSetting; config: Record<string, unknown> }) {
  const value = settingValue(config, field);
  const base = 'input';

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
        <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name={field.key} defaultChecked={Boolean(value)} />
        {field.label}
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="grid gap-1">
        <span className="text-xs font-bold text-[#71767B]">{field.label}</span>
        <textarea className={`${base} min-h-20`} name={field.key} defaultValue={String(value || '')} required={field.required} />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="grid gap-1">
        <span className="text-xs font-bold text-[#71767B]">{field.label}</span>
        <select className={base} name={field.key} defaultValue={String(value || '')} required={field.required}>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-[#71767B]">{field.label}</span>
      <input
        className={base}
        name={field.key}
        type={field.type === 'password' || field.secret ? 'password' : field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : 'text'}
        defaultValue={String(value || '')}
        placeholder={field.secret ? 'Leave blank to keep saved secret' : undefined}
        required={field.required && !field.secret}
      />
      {field.helpText ? <span className="text-xs text-[#71767B]">{field.helpText}</span> : null}
    </label>
  );
}

export default async function AppMarketplace() {
  await requireUser(['ADMIN']);
  const [apps, installations] = await Promise.all([
    prisma.marketplaceApp.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.appInstallation.findMany({ where: { tenantId: null, userId: null }, orderBy: { createdAt: 'desc' } }),
  ]);
  const installationByApp = new Map(installations.map((item) => [item.appId, item]));
  const activeCount = installations.filter((item) => item.active).length;
  const installedCount = apps.filter((app) => app.installed).length;
  const extensionPointCount = new Set(apps.flatMap((app) => addonExtensionSummary(app.config))).size;
  const stats = [
    { label: 'Registered add-ons', value: apps.length, icon: Boxes, tone: 'text-[#79C7FF]' },
    { label: 'Installed packages', value: installedCount, icon: UploadCloud, tone: 'text-[#D7DEE4]' },
    { label: 'Active add-ons', value: activeCount, icon: CheckCircle2, tone: 'text-[#5EE4B3]' },
    { label: 'Runtime hooks', value: extensionPointCount, icon: PlugZap, tone: 'text-[#FFE36E]' },
  ];

  return (
    <DashboardShell role="admin" title="Add-ons Center">
      <div className="grid gap-4 md:grid-cols-4">
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

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <form className="ui-panel p-5" action="/api/admin/app-marketplace" method="post" encType="multipart/form-data">
          <CsrfInput />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white">Upload Add-on Manifest</h2>
              <p className="mt-2 text-sm leading-6 text-[#8A949E]">
                Upload a JSON manifest from an add-on package, or paste it directly. Add-ons register metadata, settings, extension events, and signed webhooks; uploaded code is not executed on the server for marketplace safety.
              </p>
            </div>
            <Badge tone="blue">Manifest JSON</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            <input className="input" type="file" name="manifestFile" accept="application/json,.json" />
            <textarea
              className="input min-h-32 font-mono text-xs"
              name="manifestJson"
              placeholder='{"slug":"zoom-classroom","name":"Zoom Classroom","version":"1.0.0","settings":[{"key":"apiKey","label":"API Key","type":"password","secret":true}]}'
            />
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
              <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="install" defaultChecked />
              Install and activate after upload
            </label>
            <button className="btn-primary w-fit">Upload Add-on</button>
          </div>
        </form>

        <form className="ui-panel p-5" action="/api/admin/app-marketplace" method="post">
          <CsrfInput />
          <h2 className="text-xl font-black text-white">Built-in Add-ons</h2>
          <p className="mt-2 text-sm leading-6 text-[#8A949E]">
            Install official manifests that configure existing certificate, live class, affiliate, and webhook workflows.
          </p>
          <div className="mt-4 grid gap-3">
            <select className="input" name="catalogSlug">
              {defaultAddonCatalog.map((addon) => (
                <option key={addon.slug} value={addon.slug}>{addon.name}</option>
              ))}
            </select>
            <input type="hidden" name="install" value="true" />
            <button className="btn-primary w-fit">Install Built-in Add-on</button>
          </div>
        </form>
      </section>

      <details className="ui-panel mt-6 p-5">
        <summary className="cursor-pointer text-lg font-black text-white">Manual developer registration</summary>
        <form className="mt-4 grid gap-3" action="/api/admin/app-marketplace" method="post">
          <CsrfInput />
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="name" placeholder="Add-on name" required />
            <input className="input" name="slug" placeholder="addon-slug" required />
            <input className="input" name="version" placeholder="1.0.0" defaultValue="1.0.0" />
          </div>
          <textarea className="input min-h-24" name="description" placeholder="Description" />
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="category" placeholder="Category" />
            <input className="input" name="docsUrl" placeholder="Docs URL" />
            <input className="input" name="adminPath" placeholder="/admin/custom-page" />
          </div>
          <input className="input" name="webhookUrl" placeholder="Webhook URL" />
          <input className="input" name="permissions" placeholder="permissions comma-separated: courses:read,courses:write" />
          <input className="input" name="extensionPoints" placeholder="extension events comma-separated: runtime.live-class.booking,webhook.event.handler" />
          <p className="text-xs font-semibold leading-5 text-[#71767B]">
            Supported extension events: {addonExtensionPoints.join(', ')}. Built-in slugs can alter platform behavior; custom manifests receive matching events through signed webhooks.
          </p>
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="install" defaultChecked />
            Install and activate
          </label>
          <button className="btn-primary w-fit">Register Add-on</button>
        </form>
      </details>

      <section className="ui-panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Installed Add-ons</h2>
            <p className="mt-1 text-sm text-[#8A949E]">Each add-on can be activated, paused, configured, and referenced by platform events or signed companion services independently.</p>
          </div>
          <Link className="btn-secondary" href="/admin/integrations">Integration Settings</Link>
        </div>
      </section>

      <div className="mt-6">
        <DataTable
          headers={['Add-on', 'Status', 'Runtime Hooks', 'Actions', 'Settings']}
          rows={apps.map((app) => {
            const installation = installationByApp.get(app.id);
            const manifest = manifestFromConfig(app.config);
            const settingsSchema = addonSettingsSchema(app.config);
            const savedConfig = fromJsonObject(installation?.config);
            const extensions = addonExtensionSummary(app.config);
            const isActive = Boolean(app.installed && installation?.active);
            return [
              <div key="name" className="grid gap-1">
                <div className="font-black text-white">{app.name}</div>
                <div className="text-xs text-[#8A949E]">{app.slug} / v{addonVersion(app.config)} / {addonCategory(app.config)}</div>
                <p className="max-w-md text-sm leading-6 text-[#8A949E]">{app.description}</p>
                {manifest?.adminPath ? <Link className="text-sm font-bold text-[#1D9BF0]" href={manifest.adminPath}>Open admin page</Link> : null}
              </div>,
              <div key="status" className="grid gap-2">
                <Badge tone={app.installed ? 'green' : 'yellow'}>{app.installed ? 'Installed' : 'Registered'}</Badge>
                <Badge tone={isActive ? 'blue' : 'slate'}>{boolLabel(isActive)}</Badge>
              </div>,
              <div key="extensions" className="flex max-w-sm flex-wrap gap-2">
                {extensions.length ? extensions.map((point) => <Badge key={point}>{point}</Badge>) : <span className="text-sm text-[#8A949E]">No extension events</span>}
              </div>,
              <div key="actions" className="flex flex-wrap gap-2">
                <form action="/api/admin/app-marketplace/toggle" method="post">
                  <CsrfInput />
                  <input type="hidden" name="appId" value={app.id} />
                  <input type="hidden" name="active" value={isActive ? 'false' : 'true'} />
                  <button className={isActive ? 'btn-secondary' : 'btn-primary'}>{isActive ? 'Disable' : 'Activate'}</button>
                </form>
                <form action="/api/admin/app-marketplace" method="post">
                  <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="appId" value={app.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
                {manifest?.webhookUrl ? (
                  <form action="/api/admin/app-marketplace" method="post">
                    <CsrfInput />
                    <input type="hidden" name="_action" value="test-webhook" />
                    <input type="hidden" name="appId" value={app.id} />
                    <button className="btn-secondary">Test webhook</button>
                  </form>
                ) : null}
              </div>,
              <div key="settings" className="min-w-[280px]">
                {settingsSchema.length ? (
                  <details>
                    <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Configure</summary>
                    <form className="mt-3 grid gap-3" action="/api/admin/app-marketplace/settings" method="post">
                      <CsrfInput />
                      <input type="hidden" name="appId" value={app.id} />
                      {settingsSchema.map((field) => (
                        <SettingControl key={field.key} field={field} config={savedConfig} />
                      ))}
                      <button className="btn-primary w-fit">Save Settings</button>
                    </form>
                  </details>
                ) : (
                  <span className="text-sm text-[#8A949E]">No settings required</span>
                )}
              </div>,
            ];
          })}
        />
      </div>
    </DashboardShell>
  );
}
