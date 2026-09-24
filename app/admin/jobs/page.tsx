import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { supportedJobTypes } from '@/lib/jobs';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

function payloadSummary(payload: string) {
  const data = fromJsonObject<Record<string, unknown>>(payload);
  const visible = Object.entries(data)
    .filter(([, value]) => String(value || '').trim())
    .slice(0, 5);
  if (!visible.length) return 'No payload';
  return visible.map(([key, value]) => `${key}: ${String(value).slice(0, 80)}`).join('\n');
}

export default async function Jobs(props: { searchParams?: Promise<{ ran?: string; queued?: string; retried?: string; deleted?: string; purged?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const jobs = await prisma.jobQueue.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const pending = jobs.filter((job) => job.status === 'PENDING').length;
  const done = jobs.filter((job) => job.status === 'DONE').length;
  const failed = jobs.filter((job) => job.status === 'FAILED').length;

  return (
    <DashboardShell role="admin" title="Job Queue">
      {searchParams?.ran && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Due jobs processed.</div>}
      {searchParams?.queued && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Job queued.</div>}
      {searchParams?.retried && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Job moved back to pending.</div>}
      {searchParams?.deleted && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Job deleted.</div>}
      {searchParams?.purged && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Completed jobs purged.</div>}

      <section className="card mb-6 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Background jobs</h2>
            <p className="text-sm text-[var(--muted)]">
              Process due jobs now or enqueue common maintenance tasks for the background worker.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="yellow">{pending} pending</Badge>
              <Badge tone="green">{done} done</Badge>
              <Badge tone={failed ? 'red' : 'slate'}>{failed} failed</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action="/api/admin/jobs" method="post">
          <CsrfInput />
              <input type="hidden" name="action" value="run" />
              <button className="btn-primary">Run due jobs ({pending})</button>
            </form>
            {done > 0 && (
              <form action="/api/admin/jobs" method="post">
          <CsrfInput />
                <input type="hidden" name="action" value="purge_done" />
                <button className="btn-secondary">Purge done</button>
              </form>
            )}
          </div>
        </div>

        <form className="grid gap-3" action="/api/admin/jobs" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="enqueue" />
          <select className="input" name="type" defaultValue="email.send">
            {supportedJobTypes.map((job) => (
              <option key={job} value={job}>
                {job}
              </option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" name="recipient" placeholder="Recipient email for email.send" />
            <input className="input" name="subject" placeholder="Subject or note" />
          </div>
          <textarea className="input min-h-28" name="body" placeholder="Email body, broadcast notification body, or job note" />
          <input className="input" name="days" type="number" min="1" placeholder="Inactive days for automation.student-inactive, default 14" />
          <select className="input" name="role" defaultValue="">
            <option value="">All users for notification.broadcast</option>
            <option value="STUDENT">Students</option>
            <option value="INSTRUCTOR">Instructors</option>
            <option value="ADMIN">Admins</option>
          </select>
          <button className="btn-secondary w-fit">Enqueue Job</button>
        </form>
      </section>

      <DataTable
        headers={['Type', 'Status', 'Attempts', 'Run At', 'Payload', 'Result / Error', 'Manage']}
        rows={jobs.map((job) => [
          job.type,
          <Badge key="status" tone={job.status === 'DONE' ? 'green' : job.status === 'FAILED' ? 'red' : 'yellow'}>
            {job.status}
          </Badge>,
          job.attempts,
          job.runAt.toLocaleString(),
          <pre key="payload" className="max-w-xs whitespace-pre-wrap text-xs leading-5 text-[#71767B]">{payloadSummary(job.payload)}</pre>,
          job.lastError || '-',
          <div key="manage" className="flex flex-wrap gap-2">
            {job.status !== 'PENDING' && (
              <form action="/api/admin/jobs" method="post">
          <CsrfInput />
                <input type="hidden" name="action" value="retry" />
                <input type="hidden" name="id" value={job.id} />
                <button className="btn-secondary">Retry</button>
              </form>
            )}
            <form action="/api/admin/jobs" method="post">
          <CsrfInput />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="id" value={job.id} />
              <button className="btn-secondary">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
