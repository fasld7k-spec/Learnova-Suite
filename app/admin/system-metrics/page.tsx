import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function SystemMetrics({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const params = await searchParams;

  const rows = await prisma.systemMetricSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const latestByKey = new Map<string, string>();
  for (const metric of rows) {
    if (!latestByKey.has(metric.key)) latestByKey.set(metric.key, String(metric.value));
  }

  return (
    <DashboardShell role="admin" title="System Metrics">
      {params?.collected && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-black text-emerald-200">
          System snapshot collected.
        </div>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="DB bytes" value={latestByKey.get('database.size_bytes') || '0'} />
        <StatCard label="Pending orders" value={latestByKey.get('orders.pending') || '0'} />
        <StatCard label="Failed jobs" value={latestByKey.get('jobs.failed') || '0'} />
        <StatCard label="Open support" value={latestByKey.get('support.open') || '0'} />
      </div>

      <section className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#71767B]">Observability</p>
            <h2 className="mt-2 text-xl font-black text-white">Collect a live system snapshot</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
              Capture database size, users, courses, pending orders, failed payments, jobs, backups, support workload, and unread notifications.
            </p>
          </div>
          <form action="/api/admin/system-metrics" method="post">
            <CsrfInput />
            <input type="hidden" name="_action" value="collect-snapshot" />
            <button className="btn-primary">Collect Snapshot</button>
          </form>
        </div>
      </section>

      <form className="card mb-6 grid gap-3 md:grid-cols-3" action="/api/admin/system-metrics" method="post">
        <CsrfInput />
        <input className="input" name="key" placeholder="metric.key" />
        <input className="input" name="value" type="number" step="0.01" placeholder="Value" />
        <button className="btn-primary">Record Metric</button>
      </form>

      <DataTable
        headers={['Key', 'Value', 'Date', 'Manage']}
        rows={rows.map((metric) => [
          metric.key,
          String(metric.value),
          metric.createdAt.toLocaleString(),
          <div key="manage" className="grid min-w-[280px] gap-3">
            <form className="grid gap-2" action="/api/admin/system-metrics" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={metric.id} />
              <input className="input" name="key" defaultValue={metric.key} aria-label="Metric key" />
              <input className="input" name="value" type="number" step="0.01" defaultValue={String(metric.value)} aria-label="Metric value" />
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/system-metrics" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={metric.id} />
              <button className="btn-secondary">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
