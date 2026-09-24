import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const money = (value: unknown) => Number(value || 0).toFixed(2);
type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
const statusTone = (status: string): BadgeTone => status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'red' : 'yellow';

export default async function Grants() {
  await requireUser(['ADMIN']);
  const rows = await prisma.grantProgram.findMany({ orderBy: { createdAt: 'desc' } });
  const applications = await prisma.grantApplication.findMany({ orderBy: { createdAt: 'desc' } });
  const users = applications.length
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(new Set(applications.map((application) => application.userId))) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const appsByGrant = new Map<string, typeof applications>();
  applications.forEach((application) => {
    const current = appsByGrant.get(application.grantId) || [];
    current.push(application);
    appsByGrant.set(application.grantId, current);
  });

  return (
    <DashboardShell role="admin" title="Grant Programs">
      <form className="card mb-6 grid gap-3" action="/api/admin/grants" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Grant title" />
        <textarea className="input" name="description" placeholder="Description" />
        <input className="input" name="budget" type="number" min="0" step="0.01" placeholder="Budget" />
        <label className="flex gap-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Save Grant</button>
      </form>

      <DataTable
        headers={['Grant', 'Budget', 'Applications', 'Status', 'Actions']}
        rows={rows.map((grant) => {
          const grantApplications = appsByGrant.get(grant.id) || [];
          return [
            <div key="grant" className="min-w-72">
              <p className="font-black text-white">{grant.title}</p>
              <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-400">{grant.description}</p>
            </div>,
            `$${money(grant.budget)}`,
            <div key="apps" className="grid min-w-96 gap-3">
              {grantApplications.length ? grantApplications.map((application) => {
                const applicant = userMap.get(application.userId);
                return (
                  <div key={application.id} className="rounded-lg border border-violet-300/15 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-white">{applicant?.name || 'Student'}</p>
                        <p className="text-xs text-slate-400">{applicant?.email || application.userId}</p>
                      </div>
                      <Badge tone={statusTone(application.status)}>{application.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-medium leading-5 text-slate-300">{application.statement}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['APPROVED', 'REJECTED', 'PENDING'].map((status) => (
                        <form key={status} action="/api/admin/grants" method="post">
          <CsrfInput />
                          <input type="hidden" name="_action" value="application-status" />
                          <input type="hidden" name="applicationId" value={application.id} />
                          <input type="hidden" name="status" value={status} />
                          <button className="btn-secondary text-xs">{status}</button>
                        </form>
                      ))}
                    </div>
                  </div>
                );
              }) : <span className="text-sm font-semibold text-slate-400">No applications yet.</span>}
            </div>,
            <Badge key="status" tone={grant.active ? 'green' : 'red'}>{grant.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="actions" className="grid min-w-80 gap-3">
              <form className="grid gap-2" action="/api/admin/grants" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={grant.id} />
                <input className="input" name="title" defaultValue={grant.title} />
                <textarea className="input min-h-20" name="description" defaultValue={grant.description} />
                <input className="input" name="budget" type="number" min="0" step="0.01" defaultValue={money(grant.budget)} />
                <label className="flex gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={grant.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/grants" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={grant.id} />
                  <button className="btn-secondary">{grant.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/grants" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={grant.id} />
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
