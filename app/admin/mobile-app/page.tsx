import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { BellRing, Link2, Smartphone } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import {
  mobileApiEndpointManifest,
  mobileApiSupportedRoles,
} from '@/lib/mobile-app-api-manifest';

const platformCatalog = [
  { platform: 'ios', label: 'iOS', env: 'NEXT_PUBLIC_IOS_APP_URL', bundleLabel: 'Bundle ID', bundleKey: 'bundleId' },
  { platform: 'android', label: 'Android', env: 'NEXT_PUBLIC_ANDROID_APP_URL', bundleLabel: 'Package name', bundleKey: 'packageName' },
  { platform: 'pwa', label: 'PWA', env: 'NEXT_PUBLIC_APP_URL', bundleLabel: 'PWA app ID', bundleKey: 'appId' },
] as const;

const statusTones: Record<string, 'green' | 'yellow' | 'red' | 'slate' | 'blue'> = {
  ready: 'green',
  review: 'blue',
  draft: 'yellow',
  disabled: 'red',
};

function configString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function configBool(value: unknown) {
  return value === true || value === 'true';
}

function readiness(config: Record<string, unknown>, envName: string) {
  const status = configString(config.status);
  if (status === 'disabled') return 'Disabled';
  if (configString(config.storeUrl)) return 'Store URL configured';
  if (status === 'ready') return 'Ready';
  if (process.env[envName]) return 'Env store URL configured';
  return 'Needs store metadata';
}

export default async function MobileApp() {
  await requireUser(['ADMIN']);
  const rows = await prisma.mobileAppSetting.findMany({ orderBy: { platform: 'asc' } });
  const byPlatform = new Map(rows.map((row) => [row.platform, row]));
  const configuredCount = platformCatalog.filter((item) => byPlatform.has(item.platform)).length;
  const activeCount = platformCatalog.filter((item) => byPlatform.get(item.platform)?.active).length;
  const deepLinkCount = platformCatalog.filter((item) => configBool(fromJsonObject(byPlatform.get(item.platform)?.config).deepLinks)).length;
  const endpointEntries = Object.entries(mobileApiEndpointManifest);
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';

  return (
    <DashboardShell role="admin" title="Mobile App Settings">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Configured platforms" value={`${configuredCount}/${platformCatalog.length}`} icon={<Smartphone size={18} />} />
        <StatCard label="Active platforms" value={activeCount} icon={<BellRing size={18} />} />
        <StatCard label="Deep links enabled" value={deepLinkCount} icon={<Link2 size={18} />} />
        <StatCard label="Mobile API endpoints" value={endpointEntries.length} icon={<Link2 size={18} />} />
      </div>

      <section className="mt-6 border border-[#2F3336] bg-black p-5">
        <h2 className="text-xl font-black">Mobile Release Control</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          Manage buyer-facing iOS, Android and PWA release metadata from admin. These values can be used by public download buttons, onboarding screens and documentation without code changes.
        </p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card">
          <h2 className="text-xl font-black text-white">Web and mobile API contract</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            The website and Flutter app share this endpoint contract for buyer deployments. The mobile package accepts either the website root or the API root and normalizes traffic to the same backend.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {mobileApiSupportedRoles.map((role) => (
              <Badge key={role} tone="blue">{role}</Badge>
            ))}
            <Badge tone="green">{endpointEntries.length} endpoints mapped</Badge>
          </div>
          <div className="mt-5 grid gap-2 text-xs text-[#E7E9EA]">
            <code className="rounded-md border border-[#2F3336] bg-[#050608] p-3">{publicAppUrl.replace(/\/+$/, '')}</code>
            <code className="rounded-md border border-[#2F3336] bg-[#050608] p-3">{`${publicAppUrl.replace(/\/+$/, '')}/api`}</code>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-black text-white">Core mobile routes</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {endpointEntries.slice(0, 10).map(([key, endpoint]) => (
              <div className="rounded-md border border-[#2F3336] bg-[#050608] p-3" key={key}>
                <p className="text-xs font-black uppercase text-[#79C7FF]">{key}</p>
                <code className="mt-1 block break-all text-xs text-[#E7E9EA]">{endpoint}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6">
        <DataTable
          headers={['Platform', 'Status', 'Readiness', 'Store URL', 'Version', 'Admin Control']}
          rows={platformCatalog.map((item) => {
            const setting = byPlatform.get(item.platform);
            const config = fromJsonObject(setting?.config);
            const state = readiness(config, item.env);
            const status = configString(config.status) || 'draft';
            const storeUrl = configString(config.storeUrl);
            const bundleValue = configString(config[item.bundleKey]);
            return [
              <div key="platform" className="grid gap-1">
                <span className="font-bold text-white">{item.label}</span>
                <code className="text-xs text-[#71767B]">{item.platform}</code>
              </div>,
              <Badge key="status" tone={setting?.active === false ? 'red' : statusTones[status] || 'slate'}>
                {setting?.active === false ? 'inactive' : status}
              </Badge>,
              <Badge key="ready" tone={state === 'Needs store metadata' ? 'yellow' : state === 'Disabled' ? 'red' : 'green'}>{state}</Badge>,
              storeUrl ? <a key="store" className="max-w-[240px] truncate text-xs text-white underline" href={storeUrl}>{storeUrl}</a> : <code key="env" className="text-xs text-white">{item.env}</code>,
              String(config.version || '-'),
              <div key="manage" className="grid min-w-[520px] gap-3">
                <form className="grid gap-3" action="/api/admin/mobile-app" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="update" />
                  <input type="hidden" name="platform" value={item.platform} />
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="text-xs font-bold text-[#E7E9EA]">
                      Status
                      <select className="input mt-1" name="status" defaultValue={status}>
                        <option value="draft">Draft</option>
                        <option value="review">In review</option>
                        <option value="ready">Ready</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-[#E7E9EA]">
                      Version
                      <input className="input mt-1" name="version" placeholder="1.0.0" defaultValue={configString(config.version) || '1.0.0'} />
                    </label>
                    <label className="text-xs font-bold text-[#E7E9EA]">
                      Build
                      <input className="input mt-1" name="buildNumber" placeholder="100" defaultValue={configString(config.buildNumber)} />
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs font-bold text-[#E7E9EA]">
                      {item.bundleLabel}
                      <input className="input mt-1" name={item.bundleKey} placeholder={item.platform === 'ios' ? 'com.company.app' : item.platform === 'android' ? 'com.company.app' : 'learnova-pwa'} defaultValue={bundleValue} />
                    </label>
                    <label className="text-xs font-bold text-[#E7E9EA]">
                      Minimum supported version
                      <input className="input mt-1" name="minimumVersion" placeholder="1.0.0" defaultValue={configString(config.minimumVersion)} />
                    </label>
                  </div>
                  <label className="text-xs font-bold text-[#E7E9EA]">
                    Store or install URL
                    <input className="input mt-1" name="storeUrl" placeholder="https://apps.apple.com/app/..." defaultValue={storeUrl} />
                  </label>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs font-bold text-[#E7E9EA]">
                      Deep link scheme
                      <input className="input mt-1" name="deepLinkScheme" placeholder="learnova://" defaultValue={configString(config.deepLinkScheme)} />
                    </label>
                    <label className="text-xs font-bold text-[#E7E9EA]">
                      Universal links domain
                      <input className="input mt-1" name="universalLinks" placeholder="https://your-domain.com/app" defaultValue={configString(config.universalLinks)} />
                    </label>
                  </div>
                  <textarea className="input min-h-20" name="releaseNotes" placeholder="Release notes shown to admins or buyers" defaultValue={configString(config.releaseNotes)} />
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#E7E9EA]">
                    <label className="flex items-center gap-2">
                      <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked={setting?.active ?? true} /> Active
                    </label>
                    <label className="flex items-center gap-2">
                      <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="deepLinks" defaultChecked={configBool(config.deepLinks)} /> Enable deep links
                    </label>
                    <button className="btn-primary">Save {item.label}</button>
                  </div>
                </form>
                {setting ? (
                  <form action="/api/admin/mobile-app" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="platform" value={item.platform} />
                    <button className="btn-secondary border-red-400/40 text-red-200">Reset {item.label} settings</button>
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
