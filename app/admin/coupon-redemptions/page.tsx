import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function redemptionState(row: { orderId: string | null; order?: { status: string; createdAt: Date } | null }, cutoff: Date) {
  if (!row.orderId) return 'RESERVED';
  if (!row.order) return 'ORPHANED';
  if (row.order.status === 'PAID') return 'REDEEMED';
  if (row.order.status === 'PENDING') return row.order.createdAt < cutoff ? 'EXPIRED_RESERVATION' : 'RESERVED';
  return 'RELEASED';
}

export default async function CouponRedemptions(props: { searchParams?: Promise<{ purged?: string; deleted?: string; cleaned?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const reservationCutoff = new Date();
  reservationCutoff.setHours(reservationCutoff.getHours() - 2);
  const redemptions = await prisma.couponRedemption.findMany({ include: { order: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  const [paidCount, reservedCount, expiredCount] = await Promise.all([
    prisma.couponRedemption.count({ where: { order: { status: 'PAID' } } }),
    prisma.couponRedemption.count({ where: { order: { status: 'PENDING', createdAt: { gte: reservationCutoff } } } }),
    prisma.couponRedemption.count({
      where: {
        OR: [
          { orderId: null },
          { order: { status: { in: ['FAILED', 'CANCELLED', 'REFUNDED'] } } },
          { order: { status: 'PENDING', createdAt: { lt: reservationCutoff } } },
        ],
      },
    }),
  ]);
  const [coupons, users, orders] = await Promise.all([
    redemptions.length ? prisma.coupon.findMany({ where: { id: { in: redemptions.map((row) => row.couponId) } } }) : [],
    redemptions.length ? prisma.user.findMany({ where: { id: { in: redemptions.map((row) => row.userId) } } }) : [],
    redemptions.length ? prisma.order.findMany({ where: { id: { in: redemptions.map((row) => row.orderId).filter(Boolean) as string[] } } }) : [],
  ]);
  const couponCodes = new Map(coupons.map((coupon) => [coupon.id, coupon.code]));
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const invoiceNumbers = new Map(orders.map((order) => [order.id, order.invoiceNumber]));

  return (
    <DashboardShell role="admin" title="Coupon Redemptions">
      {(searchParams?.purged || searchParams?.deleted || searchParams?.cleaned) && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          {searchParams.deleted ? 'Coupon redemption deleted. ' : ''}
          {searchParams.purged ? 'Old coupon redemptions purged. ' : ''}
          {searchParams.cleaned ? `Released ${searchParams.cleaned} expired coupon reservation(s).` : ''}
        </div>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Paid redemptions" value={paidCount} />
        <StatCard label="Active reservations" value={reservedCount} />
        <StatCard label="Cleanup candidates" value={expiredCount} />
      </div>
      {redemptions.length ? (
        <form className="mb-4 flex flex-wrap items-end gap-3" action="/api/admin/coupon-redemptions" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge-old" />
          <label className="text-sm font-bold text-[#E7E9EA]">
            Delete records older than days
            <input className="input mt-2 w-36" name="days" type="number" min="1" defaultValue="365" />
          </label>
          <button className="btn-secondary border-red-400/40 text-red-200">Purge old redemptions</button>
        </form>
      ) : null}
      <form className="mb-4 flex flex-wrap items-center gap-3" action="/api/admin/coupon-redemptions" method="post">
        <CsrfInput />
        <input type="hidden" name="_action" value="cleanup-expired-reservations" />
        <button className="btn-secondary">Clean expired reservations</button>
      </form>
      <DataTable
        headers={['Coupon', 'User', 'Order', 'State', 'Date', 'Action']}
        rows={redemptions.map((row) => [
          couponCodes.get(row.couponId) || 'Coupon',
          userNames.get(row.userId) || 'User',
          row.orderId ? invoiceNumbers.get(row.orderId) || 'Order' : '-',
          redemptionState(row, reservationCutoff),
          row.createdAt.toLocaleString(),
          <form key="action" action="/api/admin/coupon-redemptions" method="post">
            <CsrfInput />
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={row.id} />
            <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
