import { Banknote, Clock3, ReceiptText, ShieldCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { formatMoney } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

function moneyTotal(orders: { total: unknown }[]) {
  return orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
}

export default async function Orders() {
  await requireUser(['ADMIN']);
  const orders = await prisma.order.findMany({ include: { items: true, payment: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  const paid = orders.filter((order) => order.status === 'PAID');
  const pending = orders.filter((order) => order.status === 'PENDING');
  const failed = orders.filter((order) => order.status === 'FAILED' || order.payment?.status === 'FAILED');
  const currency = orders[0]?.currency || 'USD';

  return (
    <DashboardShell role="admin" title="Orders & Payments">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Revenue In View" value={formatMoney(moneyTotal(paid), currency)} icon={<Banknote size={18} />} />
        <StatCard label="Paid Orders" value={paid.length} icon={<ShieldCheck size={18} />} />
        <StatCard label="Pending Orders" value={pending.length} icon={<Clock3 size={18} />} />
        <StatCard label="Payment Exceptions" value={failed.length} icon={<ReceiptText size={18} />} />
      </div>

      <div className="mt-8">
        <DataTable
          headers={['Invoice', 'Items', 'Total', 'Gateway', 'Payment', 'Order', 'Created', 'Actions']}
          rows={orders.map((order) => [
            <a key="invoice" className="font-black text-[#1D9BF0]" href={`/invoice?id=${order.id}`}>{order.invoiceNumber}</a>,
            order.items.length,
            formatMoney(order.total, order.currency),
            order.gateway,
            <Badge key="payment" tone={order.payment?.status === 'PAID' ? 'green' : order.payment?.status === 'FAILED' ? 'red' : 'yellow'}>{order.payment?.status || 'PENDING'}</Badge>,
            <Badge key="order" tone={order.status === 'PAID' ? 'green' : order.status === 'PENDING' ? 'yellow' : 'red'}>{order.status}</Badge>,
            order.createdAt.toLocaleDateString(),
            <div key="actions" className="grid min-w-72 gap-2">
              <div className="flex flex-wrap gap-2">
                <a className="btn-secondary" href={`/invoice?id=${order.id}`}>View</a>
                {order.status === 'PENDING' && (
                  <form action="/api/admin/orders/mark-paid" method="post">
          <CsrfInput />
                    <input type="hidden" name="orderId" value={order.id} />
                    <button className="btn-primary">Mark Paid</button>
                  </form>
                )}
                {order.status !== 'PAID' && order.status !== 'CANCELLED' && (
                  <form action="/api/admin/orders/status" method="post">
          <CsrfInput />
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <button className="btn-secondary">Cancel</button>
                  </form>
                )}
                {order.status !== 'PAID' && order.status !== 'FAILED' && (
                  <form action="/api/admin/orders/status" method="post">
          <CsrfInput />
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value="FAILED" />
                    <button className="btn-secondary">Mark Failed</button>
                  </form>
                )}
                {['FAILED', 'CANCELLED'].includes(order.status) && (
                  <form action="/api/admin/orders/status" method="post">
          <CsrfInput />
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value="PENDING" />
                    <button className="btn-secondary">Reopen</button>
                  </form>
                )}
              </div>
            </div>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
