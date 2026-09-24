import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { gatewayLabels } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/site-settings';

export default async function AdminRefunds() {
  await requireUser(['ADMIN']);
  const refunds = await prisma.refundRequest.findMany({ orderBy: { createdAt: 'desc' } });
  const [users, orders] = await Promise.all([
    refunds.length ? prisma.user.findMany({ where: { id: { in: refunds.map((refund) => refund.userId) } } }) : [],
    refunds.length ? prisma.order.findMany({ where: { id: { in: refunds.map((refund) => refund.orderId) } }, include: { payment: true } }) : [],
  ]);
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const orderById = new Map(orders.map((order) => [order.id, order]));

  return (
    <DashboardShell role="admin" title="Refund Requests">
      <DataTable
        headers={['User', 'Order', 'Amount', 'Payment', 'Reason', 'Status', 'Action']}
        rows={refunds.map((refund) => {
          const order = orderById.get(refund.orderId);
          const metadata = fromJsonObject<{ refund?: { mode?: string; gateway?: string; message?: string; providerRefundId?: string } }>(order?.payment?.metadata);
          const refundInfo = metadata.refund;
          const gateway = order?.payment?.gateway || order?.gateway || refundInfo?.gateway;
          return [
            userNames.get(refund.userId) || 'User',
            order ? <a key="order" className="font-bold text-[#1D9BF0]" href={`/invoice?id=${order.id}`}>{order.invoiceNumber}</a> : 'Order',
            order ? formatMoney(order.total, order.currency) : '-',
            <div key="payment" className="grid gap-1">
              <Badge tone={order?.status === 'REFUNDED' ? 'green' : order?.status === 'PAID' ? 'blue' : order?.status === 'FAILED' ? 'red' : 'yellow'}>{order?.status || 'MISSING'}</Badge>
              <span className="text-xs text-[#71767B]">{gateway ? gatewayLabels[gateway] || gateway : 'No payment record'} - {order?.payment?.status || 'No payment record'}</span>
              {refundInfo && (
                <span className="text-xs text-[#71767B]">
                  Refund: {refundInfo.mode === 'provider' ? `Provider${refundInfo.providerRefundId ? ` (${refundInfo.providerRefundId})` : ''}` : 'Manual/offline'} - {refundInfo.message}
                </span>
              )}
            </div>,
            refund.reason,
            <Badge key="s" tone={refund.status === 'PENDING' ? 'yellow' : refund.status === 'APPROVED' ? 'green' : 'red'}>{refund.status}</Badge>,
            <form key="a" action={`/api/admin/refunds/${refund.id}/status`} method="post" className="flex gap-2">
              <select className="input" name="status" defaultValue={refund.status}>
                <option>PENDING</option>
                <option>APPROVED</option>
                <option>REJECTED</option>
              </select>
              <button className="btn-primary">Update</button>
            </form>,
          ];
        })}
      />
    </DashboardShell>
  );
}
