import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

type Variant = { name?: string; label?: string };

function variants(raw: string) {
  return fromJsonArray<Variant>(raw).map((variant) => String(variant.name || variant.label || '').trim()).filter(Boolean);
}

function metricVariant(value: string) {
  return value.trim().replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_.-]+/g, '');
}

export default async function Experiments() {
  await requireUser(['ADMIN']);
  const [rows, metrics] = await Promise.all([
    prisma.experiment.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.systemMetricSnapshot.findMany({
      where: { key: { startsWith: 'experiment.' } },
      select: { key: true, value: true },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const metricTotals = new Map<string, number>();
  for (const metric of metrics) {
    metricTotals.set(metric.key, (metricTotals.get(metric.key) || 0) + Number(metric.value || 0));
  }

  return (
    <DashboardShell role="admin" title="A/B Experiments">
      <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/experiments" method="post">
          <CsrfInput />
          <p className="text-xs font-bold uppercase text-[#71767B]">Runtime A/B testing</p>
          <h2 className="mt-1 text-2xl font-black text-white">Create experiment</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Active experiments are served by <code>/api/experiments/[key]</code>. The endpoint returns a stable variant and records impressions automatically.
          </p>
          <div className="mt-5 grid gap-3">
            <input className="input" name="key" placeholder="Experiment key, e.g. homepage_headline" required />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="input" name="variantA" placeholder="Variant A label" required />
              <input className="input" name="variantB" placeholder="Variant B label" required />
            </div>
            <input className="input" name="variantC" placeholder="Optional Variant C label" />
            <label className="flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
              <input type="checkbox" name="active" /> Active
            </label>
            <button className="btn-primary w-fit">Save Experiment</button>
          </div>
        </form>
        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Tracking</p>
          <h3 className="mt-1 text-xl font-black text-white">How to use</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#E7E9EA]">
            <p>GET <code className="text-[#1D9BF0]">/api/experiments/homepage_headline</code> assigns and tracks an impression.</p>
            <p>POST the selected variant to the same endpoint with <code>event</code> to record conversions.</p>
            <p>Results are stored in System Metrics with keys like <code>experiment.key.variant.conversion</code>.</p>
          </div>
        </aside>
      </section>
      <DataTable
        headers={['Key', 'Variants', 'Tracking', 'Active', 'Date', 'Manage']}
        rows={rows.map((experiment) => {
          const names = variants(experiment.variants);
          const impressions = names.reduce((sum, name) => sum + (metricTotals.get(`experiment.${experiment.key}.${metricVariant(name)}.impression`) || 0), 0);
          const conversions = names.reduce((sum, name) => sum + (metricTotals.get(`experiment.${experiment.key}.${metricVariant(name)}.conversion`) || 0), 0);
          return [
            experiment.key,
            names.join(', ') || '-',
            `${impressions} impressions / ${conversions} conversions`,
            <Badge key="a" tone={experiment.active ? 'green' : 'red'}>{experiment.active ? 'Active' : 'Disabled'}</Badge>,
            experiment.createdAt.toLocaleDateString(),
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/experiments" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={experiment.id} />
                <input className="input" name="key" defaultValue={experiment.key} />
                <input className="input" name="variantA" defaultValue={names[0] || ''} />
                <input className="input" name="variantB" defaultValue={names[1] || ''} />
                <input className="input" name="variantC" defaultValue={names[2] || ''} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={experiment.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/experiments" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={experiment.id} />
                  <button className="btn-secondary">{experiment.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/experiments" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={experiment.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>,
          ];
        })}
      />
    </DashboardShell>
  );
}
