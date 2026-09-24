import { DownloadCloud, ShieldCheck, Trash2 } from 'lucide-react';

import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function formatDate(value: Date) {
  return value.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusTone(status: string): 'green' | 'yellow' | 'red' {
  if (status === 'DONE' || status === 'COMPLETED' || status === 'APPROVED') return 'green';
  if (status === 'REJECTED' || status === 'FAILED') return 'red';
  return 'yellow';
}

export default async function StudentPrivacy() {
  const user = await requireUser(['STUDENT']);
  const [exports, deletions] = await Promise.all([
    prisma.dataExportRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    prisma.dataDeletionRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6
    })
  ]);

  return (
    <DashboardShell role="student" title="Privacy Requests">
      <div className="mb-6 moe-panel rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="moe-mini-icon mt-1"><ShieldCheck size={20} /></span>
            <div>
              <h2 className="text-xl font-black text-white">Account data controls</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-400">
                Export your learning data or request account deletion. Requests are logged for admin review and audit history.
              </p>
            </div>
          </div>
          <Badge tone="green">Privacy ready</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="moe-panel rounded-2xl p-5" action="/api/student/privacy/export" method="post">
          <CsrfInput />
          <div className="flex items-start gap-4">
            <span className="moe-mini-icon"><DownloadCloud size={19} /></span>
            <div>
              <h2 className="text-lg font-black text-white">Request data export</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">Create a request for a copy of your profile, learning progress, orders, and messages.</p>
            </div>
          </div>
          <button className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center gap-2" type="submit">
            <DownloadCloud size={16} />
            Request Export
          </button>
        </form>

        <form className="moe-panel rounded-2xl p-5" action="/api/student/privacy/delete" method="post">
          <CsrfInput />
          <div className="flex items-start gap-4">
            <span className="moe-mini-icon"><Trash2 size={19} /></span>
            <div>
              <h2 className="text-lg font-black text-white">Request account deletion</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">Send a deletion request to the admin team. Active orders and certificates remain auditable until review is complete.</p>
            </div>
          </div>
          <textarea className="input mt-5 min-h-28" name="reason" placeholder="Optional reason for the request" maxLength={500} />
          <button className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-400/35 px-5 text-sm font-black text-red-200 transition hover:bg-red-500/10" type="submit">
            Request Deletion
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="moe-panel rounded-2xl p-5">
          <h2 className="text-lg font-black text-white">Export history</h2>
          <div className="mt-4 grid gap-3">
            {exports.length ? exports.map((request) => (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-violet-300/10 bg-white/[0.03] p-4" key={request.id}>
                <div>
                  <p className="text-sm font-black text-white">{formatDate(request.createdAt)}</p>
                  {request.fileUrl ? <a className="mt-1 inline-flex text-xs font-bold text-violet-200 hover:text-white" href={request.fileUrl}>Download file</a> : null}
                </div>
                <Badge tone={statusTone(request.status)}>{request.status}</Badge>
              </div>
            )) : (
              <p className="rounded-xl border border-dashed border-violet-300/15 p-4 text-sm font-semibold text-slate-400">No export requests yet.</p>
            )}
          </div>
        </section>

        <section className="moe-panel rounded-2xl p-5">
          <h2 className="text-lg font-black text-white">Deletion history</h2>
          <div className="mt-4 grid gap-3">
            {deletions.length ? deletions.map((request) => (
              <div className="rounded-xl border border-violet-300/10 bg-white/[0.03] p-4" key={request.id}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-black text-white">{formatDate(request.createdAt)}</p>
                  <Badge tone={statusTone(request.status)}>{request.status}</Badge>
                </div>
                {request.reason ? <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-400">{request.reason}</p> : null}
              </div>
            )) : (
              <p className="rounded-xl border border-dashed border-violet-300/15 p-4 text-sm font-semibold text-slate-400">No deletion requests yet.</p>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
