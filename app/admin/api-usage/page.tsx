import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

function safeDate(value?: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function ApiUsage(props: { searchParams?: Promise<{ q?: string; status?: string; from?: string; to?: string; purged?: string; deleted?: string }> }) {
  await requireUser(['ADMIN']);
  const params = await props.searchParams;
  const q = params?.q?.trim() || '';
  const status = params?.status?.trim() || '';
  const from = safeDate(params?.from);
  const to = safeDate(params?.to, true);
  const and: Prisma.ApiUsageLogWhereInput[] = [];
  if (q) and.push({ OR: [{ path: { contains: q } }, { method: { contains: q } }, { apiKeyId: { contains: q } }] });
  if (status) and.push({ status: Number(status) });
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  const where: Prisma.ApiUsageLogWhereInput = and.length ? { AND: and } : {};
  const [rows, total, filtered, success, failures, topPaths, statusGroups] = await Promise.all([
    prisma.apiUsageLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 250 }),
    prisma.apiUsageLog.count(),
    prisma.apiUsageLog.count({ where }),
    prisma.apiUsageLog.count({ where: { status: { gte: 200, lt: 400 } } }),
    prisma.apiUsageLog.count({ where: { status: { gte: 400 } } }),
    prisma.apiUsageLog.groupBy({ by: ['path'], _count: { path: true }, orderBy: { _count: { path: 'desc' } }, take: 8 }),
    prisma.apiUsageLog.groupBy({ by: ['status'], _count: { status: true }, orderBy: { _count: { status: 'desc' } }, take: 8 }),
  ]);
  const keys = rows.length
    ? await prisma.apiKey.findMany({
        where: { id: { in: rows.map((row) => row.apiKeyId).filter(Boolean) as string[] } },
        select: { id: true, name: true },
      })
      : [];
  const keyNames = new Map(keys.map((key) => [key.id, key.name]));
  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (status) exportParams.set('status', status);
  if (params?.from) exportParams.set('from', params.from);
  if (params?.to) exportParams.set('to', params.to);

  return (
    <DashboardShell role="admin" title="API Usage">
      {(params?.purged || params?.deleted) && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          {params.deleted ? 'API usage log deleted. ' : ''}
          {params.purged ? 'Old API usage logs purged.' : ''}
        </div>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total requests" value={total} />
        <StatCard label="Filtered requests" value={filtered} />
        <StatCard label="2xx/3xx" value={success} />
        <StatCard label="4xx/5xx" value={failures} />
      </div>
      <form className="card mb-6 grid gap-3 md:grid-cols-5" action="/admin/api-usage" method="get">
        <input className="input md:col-span-2" name="q" defaultValue={q} placeholder="Search path, method, or key id" />
        <input className="input" name="status" defaultValue={status} placeholder="Status, e.g. 401" />
        <input className="input" name="from" type="date" defaultValue={params?.from || ''} aria-label="From date" />
        <input className="input" name="to" type="date" defaultValue={params?.to || ''} aria-label="To date" />
        <div className="flex flex-wrap gap-3 md:col-span-5">
          <button className="btn-primary">Filter usage</button>
          <a className="btn-secondary" href="/admin/api-usage">Reset</a>
          <a className="btn-secondary" href={`/api/admin/api-usage${exportParams.size ? `?${exportParams.toString()}` : ''}`}>Export CSV</a>
        </div>
      </form>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-black text-white">Top API paths</h2>
          <div className="mt-4 grid gap-2 text-sm text-[#E7E9EA]">
            {topPaths.map((row) => (
              <div key={row.path} className="flex items-center justify-between border-t border-[#2F3336] py-2">
                <span className="truncate pr-4">{row.path}</span>
                <strong>{row._count.path}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="text-lg font-black text-white">Status mix</h2>
          <div className="mt-4 grid gap-2 text-sm text-[#E7E9EA]">
            {statusGroups.map((row) => (
              <div key={row.status} className="flex items-center justify-between border-t border-[#2F3336] py-2">
                <span>{row.status}</span>
                <strong>{row._count.status}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
      {rows.length ? (
        <form className="mb-4 flex flex-wrap items-end gap-3" action="/api/admin/api-usage" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge-old" />
          <label className="text-sm font-bold text-[#E7E9EA]">
            Delete records older than days
            <input className="input mt-2 w-36" name="days" type="number" min="1" defaultValue="90" />
          </label>
          <button className="btn-secondary border-red-400/40 text-red-200">Purge old API logs</button>
        </form>
      ) : null}
      <DataTable
        headers={['Path', 'Method', 'Status', 'Key', 'Date', 'Action']}
        rows={rows.map((row) => [
          row.path,
          row.method,
          row.status,
          row.apiKeyId ? keyNames.get(row.apiKeyId) || 'Deleted API key' : 'Public request',
          row.createdAt.toLocaleString(),
          <form key="action" action="/api/admin/api-usage" method="post">
            <CsrfInput />
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={row.id} />
            <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
