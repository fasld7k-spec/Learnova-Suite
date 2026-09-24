import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { getAffiliateAddon } from '@/lib/affiliate';
import { currentAppUrl } from '@/lib/request-url';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default async function Affiliate() {
  const user = await requireUser(['STUDENT']);
  const [links, commissions, addon, appUrl] = await Promise.all([
    prisma.affiliateLink.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.affiliateCommission.findMany({ where: { affiliateUserId: user.id }, orderBy: { createdAt: 'desc' } }),
    getAffiliateAddon(),
    currentAppUrl()
  ]);
  const orders = commissions.length
    ? await prisma.order.findMany({ where: { id: { in: commissions.map((commission) => commission.orderId) } } })
    : [];
  const invoiceNumbers = new Map(orders.map((order) => [order.id, order.invoiceNumber]));
  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
  const totalSales = links.reduce((sum, link) => sum + link.sales, 0);
  const pending = commissions
    .filter((commission) => commission.status === 'PENDING')
    .reduce((sum, commission) => sum + Number(commission.amount), 0);
  const approved = commissions
    .filter((commission) => commission.status === 'APPROVED' || commission.status === 'PAID')
    .reduce((sum, commission) => sum + Number(commission.amount), 0);

  return (
    <DashboardShell role="student" title="Affiliate Program">
      {!addon.active ? (
        <section className="mb-6 border border-[#2F3336] bg-black p-5">
          <Badge tone="yellow">Add-on disabled</Badge>
          <h2 className="mt-3 text-2xl font-black text-white">Affiliate program is currently inactive</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
            The site admin can activate Affiliate Growth Kit to enable referral links, tracking cookies, and commission ledger entries.
          </p>
        </section>
      ) : (
        <section className="mb-6 border border-[#2F3336] bg-black p-5">
          <Badge tone="green">Active add-on</Badge>
          <p className="mt-3 text-sm font-bold text-[#E7E9EA]">
            Earn {addon.defaultCommission}% commission on tracked paid orders. Referral cookies last {addon.cookieDays} days.
          </p>
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Referral links', links.length],
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

      <form className="card mt-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]" action="/api/student/affiliate" method="post">
        <CsrfInput />
        <div>
          <h2 className="text-xl font-black text-white">Create campaign link</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Generate a referral URL for social, newsletter, cohort, or partner campaigns.</p>
        </div>
        <select className="input" name="channel" defaultValue="social">
          <option value="social">Social campaign</option>
          <option value="newsletter">Newsletter campaign</option>
          <option value="cohort">Cohort invite</option>
          <option value="partner">Partner share</option>
        </select>
        <button className="btn-primary self-start" disabled={!addon.active}>Generate</button>
      </form>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <DataTable
          headers={['Campaign URL', 'Clicks', 'Sales', 'Created']}
          rows={links.map((link) => [
            <div className="max-w-[420px]" key={link.id}>
              <p className="break-all font-bold text-white">{`${appUrl}/courses?ref=${link.code}`}</p>
              <p className="mt-1 text-xs text-[#71767B]">{link.code}</p>
            </div>,
            link.clicks,
            link.sales,
            link.createdAt.toLocaleDateString()
          ])}
        />

        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white">Commission ledger</h2>
              <p className="mt-1 text-sm text-[#71767B]">{money.format(pending)} pending review</p>
            </div>
            <Badge tone="blue">{commissions.length} rows</Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {commissions.length === 0 ? (
              <p className="text-sm text-[#71767B]">No commissions yet. Share an affiliate link or generate a campaign URL to start the flow.</p>
            ) : (
              commissions.map((commission) => (
                <div className="border border-[#2F3336] p-4" key={commission.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-white">{money.format(Number(commission.amount))}</p>
                    <Badge tone={commission.status === 'APPROVED' || commission.status === 'PAID' ? 'green' : 'yellow'}>{commission.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-[#71767B]">Order {invoiceNumbers.get(commission.orderId) || 'processing'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
