import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
const appTone = (status: string): BadgeTone => status === 'HIRED' ? 'green' : status === 'REJECTED' ? 'red' : status === 'SHORTLISTED' ? 'blue' : 'yellow';

export default async function JobsBoardAdmin() {
  await requireUser(['ADMIN']);
  const rows = await prisma.jobBoardPost.findMany({ orderBy: { createdAt: 'desc' } });
  const applications = await prisma.jobApplication.findMany({ orderBy: { createdAt: 'desc' } });
  const users = applications.length
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(new Set(applications.map((application) => application.userId))) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const appsByJob = new Map<string, typeof applications>();
  applications.forEach((application) => {
    const current = appsByJob.get(application.jobId) || [];
    current.push(application);
    appsByJob.set(application.jobId, current);
  });

  return (
    <DashboardShell role="admin" title="Jobs Board">
      <form className="card mb-6 grid gap-3" action="/api/admin/jobs-board" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Job title" required />
        <input className="input" name="company" placeholder="Company" required />
        <input className="input" name="location" placeholder="Location" />
        <input className="input" name="url" placeholder="Apply URL or /internal-path" />
        <textarea className="input min-h-28" name="description" placeholder="Description" required />
        <label className="flex gap-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Post Job</button>
      </form>

      <DataTable
        headers={['Job', 'Applications', 'Status', 'Actions']}
        rows={rows.map((job) => {
          const jobApplications = appsByJob.get(job.id) || [];
          return [
            <div key="job" className="min-w-72">
              <p className="font-black text-white">{job.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-300">{job.company} / {job.location || 'Remote'}</p>
              <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-400">{job.description}</p>
              {job.url ? <p className="mt-2 break-all text-xs text-[#79C7FF]">{job.url}</p> : null}
            </div>,
            <div key="applications" className="grid min-w-96 gap-3">
              {jobApplications.length ? jobApplications.map((application) => {
                const applicant = userMap.get(application.userId);
                return (
                  <div key={application.id} className="rounded-lg border border-violet-300/15 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-white">{applicant?.name || 'Applicant'}</p>
                        <p className="text-xs text-slate-400">{applicant?.email || application.userId}</p>
                      </div>
                      <Badge tone={appTone(application.status)}>{application.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs font-medium leading-5 text-slate-300">{application.coverNote || 'No cover note.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['SHORTLISTED', 'REJECTED', 'HIRED', 'APPLIED'].map((status) => (
                        <form key={status} action="/api/admin/jobs-board" method="post">
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
            <Badge key="status" tone={job.active ? 'green' : 'red'}>{job.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="actions" className="grid min-w-80 gap-3">
              <form className="grid gap-2" action="/api/admin/jobs-board" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={job.id} />
                <input className="input" name="title" defaultValue={job.title} />
                <input className="input" name="company" defaultValue={job.company} />
                <input className="input" name="location" defaultValue={job.location || ''} />
                <input className="input" name="url" defaultValue={job.url || ''} />
                <textarea className="input min-h-24" name="description" defaultValue={job.description} />
                <label className="flex gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={job.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/jobs-board" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={job.id} />
                  <button className="btn-secondary">{job.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/jobs-board" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={job.id} />
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
