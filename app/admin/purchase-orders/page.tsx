import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const money = (value: unknown) => Number(value || 0).toFixed(2);
const statuses = ['OPEN', 'APPROVED', 'PAID', 'VOID'];
const statusTone = (status: string) => status === 'PAID' || status === 'APPROVED' ? 'green' : status === 'VOID' ? 'red' : 'yellow';

export default async function PurchaseOrders() {
  await requireUser(['ADMIN']);
  const [rows, organizations, orders] = await Promise.all([
    prisma.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.organization.findMany({ orderBy: { name: 'asc' } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
  ]);
  const organizationNames = new Map(organizations.map((organization) => [organization.id, organization.name]));
  const invoiceNumbers = new Map(orders.map((order) => [order.id, order.invoiceNumber]));

  return (
    <DashboardShell role="admin" title="Purchase Orders">
      <form className="card mb-6 grid gap-3 md:grid-cols-5" action="/api/admin/purchase-orders" method="post">
          <CsrfInput />
        <input className="input" name="poNumber" placeholder="PO-001" required />
        <select className="input" name="organizationId">
          <option value="">No organization</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </select>
        <select className="input" name="orderId">
          <option value="">No linked order</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>{order.invoiceNumber}</option>
          ))}
        </select>
        <input className="input" name="amount" type="number" step="0.01" min={0} placeholder="Amount" />
        <select className="input" name="status" defaultValue="OPEN">
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="btn-primary">Create PO</button>
      </form>
      <DataTable
        headers={['PO', 'Organization', 'Amount', 'Status', 'Order', 'Date', 'Manage']}
        rows={rows.map((row) => [
          row.poNumber,
          row.organizationId ? organizationNames.get(row.organizationId) || 'Organization' : '-',
          `$${money(row.amount)}`,
          <Badge key="s" tone={statusTone(row.status)}>{row.status}</Badge>,
          row.orderId ? invoiceNumbers.get(row.orderId) || 'Order' : '-',
          row.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/purchase-orders" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={row.id} />
              <input className="input" name="poNumber" defaultValue={row.poNumber} />
              <select className="input" name="organizationId" defaultValue={row.organizationId || ''}>
                <option value="">No organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
              <select className="input" name="orderId" defaultValue={row.orderId || ''}>
                <option value="">No linked order</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{order.invoiceNumber}</option>
                ))}
              </select>
              <input className="input" name="amount" type="number" min="0" step="0.01" defaultValue={money(row.amount)} />
              <select className="input" name="status" defaultValue={row.status}>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/purchase-orders" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={row.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
