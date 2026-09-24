import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
const tone = (status: string): BadgeTone => status === 'DONE' ? 'green' : status === 'REJECTED' ? 'red' : status === 'PENDING' ? 'yellow' : 'blue';

function PrivacyActions({ id, type, disabled }: { id: string; type: 'export' | 'deletion'; disabled: boolean }) {
  if (disabled) return <span className="text-xs font-semibold text-slate-500">Closed</span>;
  return (
    <div className="grid min-w-64 gap-2">
      <form className="flex gap-2" action="/api/admin/privacy-requests" method="post">
          <CsrfInput />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="action" value="complete" />
        <button className="btn-secondary">{type === 'export' ? 'Generate Export' : 'Anonymize Account'}</button>
      </form>
      <form className="grid gap-2" action="/api/admin/privacy-requests" method="post">
          <CsrfInput />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="action" value="reject" />
        <input className="input" name="reason" placeholder="Rejection note" />
        <button className="btn-secondary border-red-400/40 text-red-200">Reject</button>
      </form>
    </div>
  );
}

export default async function PrivacyRequests() {
  await requireUser(['ADMIN']);
  const [exports, deletions] = await Promise.all([
    prisma.dataExportRequest.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.dataDeletionRequest.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const userIds = Array.from(new Set([...exports.map((row) => row.userId), ...deletions.map((row) => row.userId)]));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, status: true } }) : [];
  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <DashboardShell role="admin" title="Privacy Requests">
      <h2 className="mb-3 text-xl font-bold">Export Requests</h2>
      <DataTable
        headers={['User', 'Status', 'File', 'Date', 'Actions']}
        rows={exports.map((row) => {
          const user = userMap.get(row.userId);
          return [
            <div key="user">
              <p className="font-bold text-white">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400">{user?.email || row.userId}</p>
            </div>,
            <Badge key="status" tone={tone(row.status)}>{row.status}</Badge>,
            row.fileUrl ? <a key="file" href={row.fileUrl} className="text-[#1D9BF0]">Download JSON</a> : '-',
            row.createdAt.toLocaleDateString(),
            <PrivacyActions key="actions" id={row.id} type="export" disabled={row.status !== 'PENDING'} />,
          ];
        })}
      />

      <h2 className="mb-3 mt-8 text-xl font-bold">Deletion Requests</h2>
      <DataTable
        headers={['User', 'Reason', 'Status', 'Date', 'Actions']}
        rows={deletions.map((row) => {
          const user = userMap.get(row.userId);
          return [
            <div key="user">
              <p className="font-bold text-white">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400">{user?.email || row.userId}</p>
            </div>,
            row.reason || '-',
            <Badge key="status" tone={tone(row.status)}>{row.status}</Badge>,
            row.createdAt.toLocaleDateString(),
            <PrivacyActions key="actions" id={row.id} type="deletion" disabled={row.status !== 'PENDING'} />,
          ];
        })}
      />
    </DashboardShell>
  );
}
