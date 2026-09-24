import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { getAffiliateAddon } from '@/lib/affiliate';
import { CsrfInput } from '@/components/CsrfInput';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default async function Affiliates() {
  await requireUser(['ADMIN']);
  const [links, commissions, users, orders, addon] = await Promise.all([
    prisma.affiliateLink.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.affiliateCommission.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, orderBy: { createdAt: 'desc' } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    getAffiliateAddon()
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const invoicesById = new Map(orders.map((order) => [order.id, order.invoiceNumber]));
  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
  const totalSales = links.reduce((sum, link) => sum + link.sales, 0);
  const pending = commissions
    .filter((commission) => commission.status === 'PENDING')
    .reduce((sum, commission) => sum + Number(commission.amount), 0);
  const approved = commissions
    .filter((commission) => commission.status === 'APPROVED' || commission.status === 'PAID')
    .reduce((sum, commission) => sum + Number(commission.amount), 0);

  return (
    <DashboardShell role="admin" title="Affiliates">
      {!addon.active ? (
        <section className="mb-6 border border-[#2F3336] bg-black p-5">
          <Badge tone="yellow">Add-on disabled</Badge>
          <h2 className="mt-3 text-2xl font-black text-white">Affiliate Growth is inactive</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
            Activate Affiliate Growth Kit from the Add-ons Center to generate referral links, track clicks, and record commissions.
          </p>
          <a className="btn-primary mt-4 w-fit" href="/admin/app-marketplace">Open Add-ons Center</a>
        </section>
      ) : (
        <section className="mb-6 border border-[#2F3336] bg-black p-5">
          <Badge tone="green">Active add-on</Badge>
          <p className="mt-3 text-sm font-bold text-[#E7E9EA]">
            Default commission: {addon.defaultCommission}% / Tracking cookie: {addon.cookieDays} days
          </p>
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Links', links.length],
          ['Clicks', totalClicks],
          ['Sales', totalSales],
          ['Approved', money.format(approved)]
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <p className="text-sm font-bold text-[#71767B]">{label}</p>
            <p className="mt-2 text-3xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <form className="card grid gap-3" action="/api/admin/affiliates" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="create-link" />
          <div>
            <h2 className="text-xl font-black text-white">Create affiliate link</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">Issue a referral code and starting metrics for a student affiliate.</p>
          </div>
          <select className="input" name="userId">
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email} - {user.email}
              </option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="code" placeholder="Code, optional" />
            <input className="input" name="clicks" type="number" min="0" placeholder="Clicks" />
            <input className="input" name="sales" type="number" min="0" placeholder="Sales" />
          </div>
          <button className="btn-primary w-fit">Save Link</button>
        </form>

        <form className="card grid gap-3" action="/api/admin/affiliates" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="record-commission" />
          <div>
            <h2 className="text-xl font-black text-white">Record commission</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">Attach a payout row to a recent order for commission review.</p>
          </div>
          <select className="input" name="affiliateUserId">
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email} - {user.email}
              </option>
            ))}
          </select>
          <select className="input" name="orderId">
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.invoiceNumber} - {money.format(Number(order.total))}
              </option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" name="amount" type="number" min="0" step="0.01" placeholder={`Amount, defaults to ${addon.defaultCommission}%`} />
            <select className="input" name="status" defaultValue="PENDING">
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>
          <button className="btn-primary w-fit">Record Commission</button>
        </form>
      </div>

      <div className="mt-6 grid gap-6">
        <DataTable
          headers={['Affiliate', 'Code', 'Clicks', 'Sales', 'Created', 'Manage']}
          rows={links.map((link) => {
            const user = usersById.get(link.userId);
            return [
              <div key={link.id}>
                <p className="font-bold text-white">{user?.name || 'Unknown student'}</p>
                <p className="text-xs text-[#71767B]">{user?.email || link.userId}</p>
              </div>,
              <span className="font-bold text-white" key="code">{link.code}</span>,
              link.clicks,
              link.sales,
              link.createdAt.toLocaleDateString(),
              <div key="manage" className="grid min-w-[300px] gap-2">
                <form className="grid gap-2" action="/api/admin/affiliates" method="post">
          <CsrfInput />
                  <input type="hidden" name="action" value="update-link" />
                  <input type="hidden" name="id" value={link.id} />
                  <select className="input" name="userId" defaultValue={link.userId}>
                    {users.map((row) => (
                      <option key={row.id} value={row.id}>{row.email}</option>
                    ))}
                  </select>
                  <div className="grid gap-2 md:grid-cols-3">
                    <input className="input" name="code" defaultValue={link.code} />
                    <input className="input" name="clicks" type="number" min="0" defaultValue={link.clicks} />
                    <input className="input" name="sales" type="number" min="0" defaultValue={link.sales} />
                  </div>
                  <button className="btn-secondary w-fit">Update Link</button>
                </form>
                <form action="/api/admin/affiliates" method="post">
          <CsrfInput />
                  <input type="hidden" name="action" value="delete-link" />
                  <input type="hidden" name="id" value={link.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete Link</button>
                </form>
              </div>
            ];
          })}
        />

        <DataTable
          headers={['Affiliate', 'Order', 'Amount', 'Status', 'Created', 'Manage']}
          rows={commissions.map((commission) => {
            const user = usersById.get(commission.affiliateUserId);
            return [
              user?.email || commission.affiliateUserId,
              invoicesById.get(commission.orderId) || 'Order',
              money.format(Number(commission.amount)),
              <Badge key="status" tone={commission.status === 'APPROVED' || commission.status === 'PAID' ? 'green' : commission.status === 'VOID' ? 'red' : 'yellow'}>{commission.status}</Badge>,
              commission.createdAt.toLocaleDateString(),
              <div key="manage" className="grid min-w-[260px] gap-2">
                <form className="grid gap-2" action="/api/admin/affiliates" method="post">
          <CsrfInput />
                  <input type="hidden" name="action" value="update-commission" />
                  <input type="hidden" name="id" value={commission.id} />
                  <input className="input" name="amount" type="number" min="0" step="0.01" defaultValue={Number(commission.amount)} />
                  <select className="input" name="status" defaultValue={commission.status}>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PAID">Paid</option>
                    <option value="VOID">Void</option>
                  </select>
                  <button className="btn-secondary w-fit">Update Commission</button>
                </form>
                <form action="/api/admin/affiliates" method="post">
          <CsrfInput />
                  <input type="hidden" name="action" value="delete-commission" />
                  <input type="hidden" name="id" value={commission.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete Commission</button>
                </form>
              </div>
            ];
          })}
        />
      </div>

      <p className="mt-4 text-sm text-[#71767B]">{money.format(pending)} pending commission review across {commissions.length} ledger rows.</p>
    </DashboardShell>
  );
}
