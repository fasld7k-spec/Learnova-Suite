import { Download, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function LoginHistory(props: { searchParams?: Promise<{ result?: string; email?: string; status?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);

  const result = searchParams?.result;
  const email = searchParams?.email?.trim();
  const status = searchParams?.status;
  const where = {
    ...(result === 'success' ? { success: true } : {}),
    ...(result === 'failed' ? { success: false } : {}),
    ...(email ? { email: { contains: email } } : {}),
  };

  const [rows, successCount, failedCount] = await Promise.all([
    prisma.loginHistory.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.loginHistory.count({ where: { success: true } }),
    prisma.loginHistory.count({ where: { success: false } }),
  ]);
  const users = rows.length
    ? await prisma.user.findMany({
        where: { id: { in: rows.map((row) => row.userId).filter(Boolean) as string[] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userLabels = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));
  const exportParams = new URLSearchParams();
  if (email) exportParams.set('email', email);
  if (result) exportParams.set('result', result);
  const exportHref = `/api/admin/login-history/export${exportParams.size ? `?${exportParams.toString()}` : ''}`;

  return (
    <DashboardShell role="admin" title="Login History">
      {status && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          Login history action completed: {status}.
        </div>
      )}
      <section className="card mb-6">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" action="/admin/login-history">
          <input className="input" name="email" defaultValue={email} placeholder="Filter by email" />
          <select className="input" name="result" defaultValue={result || ''}>
            <option value="">All results</option>
            <option value="success">Success only</option>
            <option value="failed">Failed only</option>
          </select>
          <button className="btn-primary">Filter</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="green">Success {successCount}</Badge>
          <Badge tone="red">Failed {failedCount}</Badge>
          <a className="btn-secondary" href={exportHref}>
            <Download size={16} />
            Export CSV
          </a>
        </div>
      </section>

      <section className="card mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <ShieldAlert className="text-[#1D9BF0]" size={22} />
            <h2 className="mt-3 text-xl font-black text-white">Security log maintenance</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
              Keep login telemetry useful by exporting records before cleanup, then removing noisy failed attempts or stale records after review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action="/api/admin/login-history" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="purge_failed" />
              <button className="btn-secondary border-red-400/40 text-red-200">
                <Trash2 size={16} />
                Purge failed
              </button>
            </form>
            <form className="flex flex-wrap gap-2" action="/api/admin/login-history" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="purge_old" />
              <input className="input w-28" name="days" type="number" min="1" max="3650" defaultValue={90} />
              <button className="btn-secondary border-red-400/40 text-red-200">
                <Trash2 size={16} />
                Purge old
              </button>
            </form>
          </div>
        </div>
      </section>
      <DataTable
        headers={['Email', 'User', 'Result', 'IP', 'User agent', 'Date', 'Manage']}
        rows={rows.map((login) => [
          login.email,
          login.userId ? userLabels.get(login.userId) || 'Deleted user' : 'Guest',
          <Badge key="s" tone={login.success ? 'green' : 'red'}>{login.success ? 'Success' : 'Failed'}</Badge>,
          login.ip || '-',
          <span key="ua" className="block max-w-[320px] truncate" title={login.userAgent || '-'}>
            {login.userAgent || '-'}
          </span>,
          login.createdAt.toLocaleString(),
          <form key="manage" action="/api/admin/login-history" method="post">
          <CsrfInput />
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={login.id} />
            <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
