import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const statuses = ['PENDING', 'SENT', 'SIGNED', 'EXPIRED', 'REVOKED'];
type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
const tone = (status: string): BadgeTone => status === 'SIGNED' ? 'green' : status === 'REVOKED' || status === 'EXPIRED' ? 'red' : status === 'SENT' ? 'blue' : 'yellow';

export default async function Dpa() {
  await requireUser(['ADMIN']);
  const rows = await prisma.dpaAgreement.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="admin" title="DPA Agreements">
      <form className="card mb-6 grid gap-3 md:grid-cols-5" action="/api/admin/dpa" method="post">
          <CsrfInput />
        <input className="input" name="company" placeholder="Company" required />
        <input className="input" name="email" type="email" placeholder="Email" required />
        <input className="input" name="fileUrl" placeholder="File URL or /path" />
        <select className="input" name="status" defaultValue="PENDING">
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="btn-primary">Create DPA</button>
      </form>

      <DataTable
        headers={['Company', 'Email', 'Status', 'File', 'Manage']}
        rows={rows.map((dpa) => [
          dpa.company,
          dpa.email,
          <Badge key="status" tone={tone(dpa.status)}>{dpa.status}</Badge>,
          dpa.fileUrl ? <a key="file" className="text-[#1D9BF0]" href={dpa.fileUrl}>Open file</a> : '-',
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/dpa" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={dpa.id} />
              <input className="input" name="company" defaultValue={dpa.company} />
              <input className="input" name="email" type="email" defaultValue={dpa.email} />
              <input className="input" name="fileUrl" defaultValue={dpa.fileUrl || ''} />
              <select className="input" name="status" defaultValue={dpa.status}>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/dpa" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={dpa.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
