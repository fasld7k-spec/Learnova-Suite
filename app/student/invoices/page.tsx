import { Download, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { formatMoney } from '@/lib/site-settings';

export default async function Invoices() {
  const user = await requireUser(['STUDENT']);
  const orders = await prisma.order.findMany({ where: { userId: user.id }, include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  const paid = orders.filter((order) => order.status === 'PAID');
  const pending = orders.filter((order) => order.status === 'PENDING');
  const currency = orders[0]?.currency || 'USD';
  const totalPaid = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);

  return (
    <DashboardShell role="student" title="Invoices">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Paid invoices" value={paid.length} icon={<ShieldCheck size={18} />} />
        <StatCard label="Pending invoices" value={pending.length} icon={<WalletCards size={18} />} />
        <StatCard label="Total paid" value={formatMoney(totalPaid, currency)} icon={<ReceiptText size={18} />} />
      </div>

      <div className="mt-8">
        <DataTable
          headers={['Invoice', 'Items', 'Total', 'Payment', 'Status', 'Date', 'Action']}
          rows={orders.map((order) => [
            <span key="invoice" className="font-black">{order.invoiceNumber}</span>,
            order.items.length,
            formatMoney(order.total, order.currency),
            <Badge key="payment" tone={order.payment?.status === 'PAID' ? 'green' : order.payment?.status === 'FAILED' ? 'red' : 'yellow'}>{order.payment?.status || 'PENDING'}</Badge>,
            <Badge key="status" tone={order.status === 'PAID' ? 'green' : order.status === 'PENDING' ? 'yellow' : 'red'}>{order.status}</Badge>,
            order.createdAt.toLocaleDateString(),
            <a key="action" className="btn-secondary inline-flex items-center gap-2" href={`/invoice?id=${order.id}`}>
              <Download size={15} />
              View
            </a>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
