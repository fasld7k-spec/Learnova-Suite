import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
const statusTone = (status: string): BadgeTone => status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'red' : 'yellow';

export default async function Scholarships() {
  await requireUser(['ADMIN']);
  const rows = await prisma.scholarship.findMany({ orderBy: { createdAt: 'desc' } });
  const applications = await prisma.scholarshipApplication.findMany({ orderBy: { createdAt: 'desc' } });
  const users = applications.length
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(new Set(applications.map((application) => application.userId))) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const appsByScholarship = new Map<string, typeof applications>();
  applications.forEach((application) => {
    const current = appsByScholarship.get(application.scholarshipId) || [];
    current.push(application);
    appsByScholarship.set(application.scholarshipId, current);
  });

  return (
    <DashboardShell role="admin" title="Scholarships">
      <form className="card mb-6 grid gap-3" action="/api/admin/scholarships" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Scholarship title" />
        <textarea className="input" name="description" placeholder="Description" />
        <input className="input" name="percent" type="number" min="1" max="100" placeholder="Discount percent" />
        <label className="flex gap-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Save Scholarship</button>
      </form>

      <DataTable
        headers={['Scholarship', 'Discount', 'Applications', 'Status', 'Actions']}
        rows={rows.map((scholarship) => {
          const scholarshipApplications = appsByScholarship.get(scholarship.id) || [];
          return [
            <div key="scholarship" className="min-w-72">
              <p className="font-black text-white">{scholarship.title}</p>
              <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-400">{scholarship.description}</p>
            </div>,
            `${scholarship.percent}%`,
            <div key="apps" className="grid min-w-96 gap-3">
              {scholarshipApplications.length ? scholarshipApplications.map((application) => {
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
                        <form key={status} action="/api/admin/scholarships" method="post">
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
            <Badge key="status" tone={scholarship.active ? 'green' : 'red'}>{scholarship.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="actions" className="grid min-w-80 gap-3">
              <form className="grid gap-2" action="/api/admin/scholarships" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={scholarship.id} />
                <input className="input" name="title" defaultValue={scholarship.title} />
                <textarea className="input min-h-20" name="description" defaultValue={scholarship.description} />
                <input className="input" name="percent" type="number" min="1" max="100" defaultValue={scholarship.percent} />
                <label className="flex gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={scholarship.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/scholarships" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={scholarship.id} />
                  <button className="btn-secondary">{scholarship.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/scholarships" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={scholarship.id} />
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
