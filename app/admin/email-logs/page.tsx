import { MailCheck, MailWarning, Send } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

function statusTone(status: string): 'green' | 'yellow' | 'red' {
  if (status === 'SENT') return 'green';
  if (status === 'FAILED') return 'red';
  return 'yellow';
}

export default async function EmailLogs() {
  await requireUser(['ADMIN']);
  const rows = await prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const sent = rows.filter((row) => row.status === 'SENT').length;
  const failed = rows.filter((row) => row.status === 'FAILED').length;
  const queued = rows.length - sent - failed;

  return (
    <DashboardShell role="admin" title="Email Logs">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <Send className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-3xl font-black text-white">{queued}</p>
          <p className="mt-1 text-sm font-bold text-[#71767B]">Queued</p>
        </div>
        <div className="card">
          <MailCheck className="text-[#00BA7C]" size={22} />
          <p className="mt-4 text-3xl font-black text-white">{sent}</p>
          <p className="mt-1 text-sm font-bold text-[#71767B]">Sent</p>
        </div>
        <div className="card">
          <MailWarning className="text-[#F4212E]" size={22} />
          <p className="mt-4 text-3xl font-black text-white">{failed}</p>
          <p className="mt-1 text-sm font-bold text-[#71767B]">Failed</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <h2 className="text-xl font-black text-white">No email logs yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
            Support, password reset, contact, and automation emails will be recorded here with provider metadata.
          </p>
        </div>
      ) : (
        <DataTable
          headers={['To', 'Subject', 'Status', 'Provider', 'Preview', 'Date', 'Action']}
          rows={rows.map((email) => {
            const meta = fromJsonObject(email.meta);
            const provider = typeof meta.provider === 'string' ? meta.provider : 'log';
            const htmlPreview = typeof meta.htmlPreview === 'string' ? meta.htmlPreview : '-';
            return [
              email.to,
              email.subject,
              <Badge key="status" tone={statusTone(email.status)}>
                {email.status}
              </Badge>,
              provider,
              htmlPreview,
              email.createdAt.toLocaleString(),
              <form key="action" action="/api/admin/email-logs" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={email.id} />
                <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
              </form>
            ];
          })}
        />
      )}
    </DashboardShell>
  );
}
