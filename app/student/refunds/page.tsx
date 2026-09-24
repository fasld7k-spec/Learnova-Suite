import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Refunds() {
  const user = await requireUser(['STUDENT']);
  const [orders, refunds] = await Promise.all([
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.refundRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const invoices = new Map(orders.map((order) => [order.id, order.invoiceNumber]));

  return (
    <DashboardShell role="student" title="Refund Requests">
      <form className="card mb-6 grid gap-3" action="/api/student/refunds" method="post">
        <CsrfInput />
        <select className="input" name="orderId" required>
          <option value="">Select order</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>{order.invoiceNumber} - {order.status}</option>
          ))}
        </select>
        <textarea className="input min-h-28" name="reason" placeholder="Reason" required />
        <button className="btn-primary w-fit">Request Refund</button>
      </form>
      <DataTable
        headers={['Order', 'Reason', 'Status', 'Date']}
        rows={refunds.map((refund) => [
          invoices.get(refund.orderId) || 'Order',
          refund.reason,
          <Badge key="s" tone={refund.status === 'PENDING' ? 'yellow' : refund.status === 'APPROVED' ? 'green' : 'red'}>{refund.status}</Badge>,
          refund.createdAt.toLocaleDateString(),
        ])}
      />
    </DashboardShell>
  );
}
