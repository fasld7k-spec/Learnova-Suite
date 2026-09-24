import { FlaskConical, GitBranch, Power, ShieldAlert } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { systemFeatureFlags } from '@/lib/features';
import { CsrfInput } from '@/components/CsrfInput';

export default async function FeatureFlags() {
  await requireUser(['ADMIN']);
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });

  const enabled = flags.filter((flag) => flag.enabled).length;
  const documented = flags.filter((flag) => flag.description).length;
  const experimental = flags.filter((flag) => /beta|experiment|test|new/i.test(flag.key)).length;
  const existingKeys = new Set(flags.map((flag) => flag.key));
  const flagByKey = new Map(flags.map((flag) => [flag.key, flag]));

  return (
    <DashboardShell role="admin" title="Feature Flags">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Flags" value={flags.length} icon={<GitBranch size={18} />} />
        <StatCard label="Enabled" value={enabled} icon={<Power size={18} />} />
        <StatCard label="Documented" value={documented} icon={<ShieldAlert size={18} />} />
        <StatCard label="Experiments" value={experimental} icon={<FlaskConical size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/feature-flags" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Release control</p>
            <h2 className="mt-1 text-2xl font-black text-white">Add a feature flag</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Flags let administrators roll out checkout, learning and instructor features gradually without code redeploys.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1.3fr]">
            <input className="input" name="key" placeholder="new_checkout" required />
            <input className="input" name="description" placeholder="Description" />
          </div>
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="enabled" /> Enabled
          </label>
          <button className="btn-primary mt-4 w-fit">Save Flag</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Operational safety</p>
          <h3 className="mt-1 text-xl font-black text-white">Flag readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Enabled features</span>
              <Badge tone={enabled ? 'green' : 'slate'}>{enabled}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Documentation</span>
              <Badge tone={documented === flags.length && flags.length ? 'green' : 'yellow'}>{documented}/{flags.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Experiment queue</span>
              <Badge tone={experimental ? 'yellow' : 'green'}>{experimental}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6 border border-[#2F3336] bg-black p-5">
        <p className="text-xs font-bold uppercase text-[#71767B]">Built-in controls</p>
        <h2 className="mt-1 text-2xl font-black text-white">Runtime flags wired into the app</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          These keys are not decorative. When enabled, they immediately control registration, checkout, the AI assistant and the hosted demo page.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {systemFeatureFlags.map((flag) => (
            <form key={flag.key} className="border border-[#2F3336] p-4" action="/api/admin/feature-flags" method="post">
          <CsrfInput />
              <input type="hidden" name="key" value={flag.key} />
              <input type="hidden" name="description" value={flag.description} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <code className="text-xs font-bold text-[#1D9BF0]">{flag.key}</code>
                  <h3 className="mt-1 text-base font-black text-white">{flag.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#71767B]">{flag.description}</p>
                </div>
                <Badge tone={existingKeys.has(flag.key) ? 'green' : 'slate'}>{existingKeys.has(flag.key) ? 'Added' : 'Ready'}</Badge>
              </div>
              <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
                <input type="checkbox" name="enabled" defaultChecked={flagByKey.get(flag.key)?.enabled || false} /> Enabled
              </label>
              <button className="btn-secondary mt-3 w-fit">{existingKeys.has(flag.key) ? 'Refresh Definition' : 'Add Built-in Flag'}</button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Flag', 'Description', 'Updated', 'Status', 'Manage']}
          rows={flags.map((flag) => [
            <code key="key" className="text-xs text-[#1D9BF0]">{flag.key}</code>,
            flag.description || '-',
            flag.updatedAt.toLocaleDateString(),
            <Badge key="enabled" tone={flag.enabled ? 'green' : 'red'}>{flag.enabled ? 'Enabled' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/feature-flags" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={flag.id} />
                <input className="input" name="key" defaultValue={flag.key} />
                <input className="input" name="description" defaultValue={flag.description || ''} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="enabled" defaultChecked={flag.enabled} /> Enabled
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/feature-flags" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={flag.id} />
                  <button className="btn-secondary">{flag.enabled ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/feature-flags" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={flag.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
