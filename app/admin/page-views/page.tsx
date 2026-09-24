import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function PageViews() {
  await requireUser(['ADMIN']);
  const views = await prisma.pageView.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const users = views.length
    ? await prisma.user.findMany({ where: { id: { in: views.map((view) => view.userId).filter(Boolean) as string[] } } })
    : [];
  const userNames = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));

  return (
    <DashboardShell role="admin" title="Page Views">
      {views.length ? (
        <form className="mb-4 flex flex-wrap items-end gap-3" action="/api/admin/page-views" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge-old" />
          <label className="text-sm font-bold text-[#E7E9EA]">
            Delete records older than days
            <input className="input mt-2 w-36" name="days" type="number" min="1" defaultValue="90" />
          </label>
          <button className="btn-secondary border-red-400/40 text-red-200">Purge old views</button>
        </form>
      ) : null}
      <DataTable
        headers={['Path', 'User', 'Referrer', 'Date', 'Action']}
        rows={views.map((view) => [
          view.path,
          view.userId ? userNames.get(view.userId) || 'Registered user' : 'Guest',
          view.referrer || '-',
          view.createdAt.toLocaleString(),
          <form key="action" action="/api/admin/page-views" method="post">
          <CsrfInput />
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={view.id} />
            <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
