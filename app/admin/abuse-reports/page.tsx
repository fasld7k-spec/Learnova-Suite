import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate';
const tone = (status: string): BadgeTone => status === 'RESOLVED' ? 'green' : status === 'DISMISSED' ? 'red' : status === 'REVIEWING' ? 'blue' : 'yellow';

export default async function AbuseReports() {
  await requireUser(['ADMIN']);
  const rows = await prisma.abuseReport.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <DashboardShell role="admin" title="Abuse Reports">
      <DataTable
        headers={['Target', 'Reason', 'Reporter', 'Status', 'Date', 'Actions']}
        rows={rows.map((report) => [
          `${report.targetType}:${report.targetId}`,
          report.reason,
          report.reporterEmail || '-',
          <Badge key="status" tone={tone(report.status)}>{report.status}</Badge>,
          report.createdAt.toLocaleString(),
          <div key="actions" className="flex min-w-72 flex-wrap gap-2">
            <form action="/api/admin/abuse-reports" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={report.id} />
              <input type="hidden" name="action" value="queue" />
              <button className="btn-secondary">Send to Moderation</button>
            </form>
            {['REVIEWING', 'RESOLVED', 'DISMISSED', 'OPEN'].map((status) => (
              <form key={status} action="/api/admin/abuse-reports" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={report.id} />
                <input type="hidden" name="status" value={status} />
                <button className="btn-secondary text-xs">{status}</button>
              </form>
            ))}
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
