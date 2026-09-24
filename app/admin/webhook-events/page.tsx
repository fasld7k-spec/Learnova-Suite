import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function WebhookEvents() {
  await requireUser(['ADMIN']);

  const rows = await prisma.webhookEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const processedCount = rows.filter((event) => event.processed).length;
  const pendingCount = rows.length - processedCount;

  return (
    <DashboardShell role="admin" title="Webhook Events">
      <div className="card mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Webhook event ledger</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Inspect payment/provider events, mark manually handled events, and clean processed records after operational review.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="green">{processedCount} processed</Badge>
            <Badge tone={pendingCount ? 'yellow' : 'slate'}>{pendingCount} pending</Badge>
          </div>
        </div>
        <form action="/api/admin/webhook-events" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="clear-processed" />
          <button className="btn-secondary">Clear processed events</button>
        </form>
      </div>

      <DataTable
        headers={['Provider', 'Event', 'Processed', 'Payload', 'Date', 'Manage']}
        rows={rows.map((event) => [
          event.provider,
          event.eventId || '-',
          <Badge key="p" tone={event.processed ? 'green' : 'yellow'}>{event.processed ? 'Processed' : 'Pending'}</Badge>,
          <details key="payload" className="max-w-md">
            <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">View payload</summary>
            <pre className="mt-2 max-h-52 overflow-auto border border-[#2F3336] bg-[#050608] p-3 text-xs leading-5 text-[#E7E9EA]">
              {event.payload}
            </pre>
          </details>,
          event.createdAt.toLocaleString(),
          <div key="manage" className="flex min-w-72 flex-wrap gap-2">
            <form action="/api/admin/webhook-events" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="action" value="toggle" />
              <button className="btn-secondary">{event.processed ? 'Mark pending' : 'Mark processed'}</button>
            </form>
            <form action="/api/admin/webhook-events" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="action" value="delete" />
              <button className="btn-secondary">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
