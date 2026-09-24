import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const money = (value: unknown) => Number(value || 0).toFixed(2);
const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'CLOSED'];
type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
const tone = (status: string): BadgeTone => status === 'APPROVED' || status === 'CLOSED' ? 'green' : status === 'REJECTED' ? 'red' : status === 'ORDERED' ? 'blue' : 'yellow';

export default async function Procurement() {
  await requireUser(['ADMIN']);
  const rows = await prisma.procurementRequest.findMany({ orderBy: { createdAt: 'desc' } });
  const requesterIds = Array.from(new Set(rows.map((row) => row.requesterId)));
  const users = requesterIds.length ? await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true, email: true } }) : [];
  const requesters = new Map(users.map((user) => [user.id, user]));

  return (
    <DashboardShell role="admin" title="Procurement Requests">
      <form className="card mb-6 grid gap-3 md:grid-cols-5" action="/api/admin/procurement" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Request title" required />
        <input className="input" name="organizationId" placeholder="Organization ID optional" />
        <input className="input" name="budget" type="number" min="0" step="0.01" placeholder="Budget" />
        <select className="input" name="status" defaultValue="PENDING">
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="btn-primary">Create Request</button>
      </form>

      <DataTable
        headers={['Request', 'Budget', 'Requester', 'Status', 'Date', 'Manage']}
        rows={rows.map((row) => {
          const requester = requesters.get(row.requesterId);
          return [
            <div key="request">
              <p className="font-bold text-white">{row.title}</p>
              <p className="text-xs text-slate-400">{row.organizationId || 'No organization'}</p>
            </div>,
            `$${money(row.budget)}`,
            requester ? `${requester.name} (${requester.email})` : row.requesterId,
            <Badge key="status" tone={tone(row.status)}>{row.status}</Badge>,
            row.createdAt.toLocaleDateString(),
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/procurement" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={row.id} />
                <input className="input" name="title" defaultValue={row.title} />
                <input className="input" name="organizationId" defaultValue={row.organizationId || ''} />
                <input className="input" name="budget" type="number" min="0" step="0.01" defaultValue={money(row.budget)} />
                <select className="input" name="status" defaultValue={row.status}>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <form action="/api/admin/procurement" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>,
          ];
        })}
      />
    </DashboardShell>
  );
}
