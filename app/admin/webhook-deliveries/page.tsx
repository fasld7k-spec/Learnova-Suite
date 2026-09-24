import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

function endpointLabel(endpoint: { name: string; url: string }) {
  try {
    return `${endpoint.name} (${new URL(endpoint.url).hostname})`;
  } catch {
    return endpoint.name;
  }
}

export default async function WebhookDeliveries() {
  await requireUser(['ADMIN']);
  const rows = await prisma.webhookDelivery.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const endpoints = rows.length
    ? await prisma.webhookEndpoint.findMany({
        where: { id: { in: rows.map((delivery) => delivery.endpointId) } },
        select: { id: true, name: true, url: true },
      })
    : [];
  const endpointMap = new Map(endpoints.map((endpoint) => [endpoint.id, endpointLabel(endpoint)]));

  return (
    <DashboardShell role="admin" title="Webhook Deliveries">
      {rows.length ? (
        <form className="mb-4 flex flex-wrap items-end gap-3" action="/api/admin/webhook-deliveries" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge-old" />
          <label className="text-sm font-bold text-[#E7E9EA]">
            Delete delivery logs older than days
            <input className="input mt-2 w-36" name="days" type="number" min="1" defaultValue="90" />
          </label>
          <button className="btn-secondary border-red-400/40 text-red-200">Purge old deliveries</button>
        </form>
      ) : null}
      <DataTable
        headers={['Endpoint', 'Event', 'Status', 'Response', 'Date', 'Manage']}
        rows={rows.map((delivery) => [
          endpointMap.get(delivery.endpointId) || 'Deleted endpoint',
          delivery.event,
          <Badge key="s" tone={delivery.status === 'SUCCESS' ? 'green' : delivery.status === 'FAILED' ? 'red' : 'yellow'}>{delivery.status}</Badge>,
          <span key="response" className="block max-w-md truncate text-xs text-[#71767B]">{delivery.response || '-'}</span>,
          delivery.createdAt.toLocaleString(),
          <div key="manage" className="flex min-w-48 flex-wrap gap-2">
            <form action="/api/admin/webhook-deliveries/retry" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={delivery.id} />
              <button className="btn-secondary min-h-9 px-3">Retry</button>
            </form>
            <form action="/api/admin/webhook-deliveries" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={delivery.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
