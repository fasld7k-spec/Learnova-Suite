import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { couponLabel } from '@/lib/coupons';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

function couponStatus(coupon: { active: boolean; startsAt: Date | null; expiresAt: Date | null }, used: number, maxUses?: number | null) {
  const now = new Date();
  if (!coupon.active) return { label: 'Disabled', tone: 'red' as const };
  if (coupon.startsAt && coupon.startsAt > now) return { label: 'Scheduled', tone: 'yellow' as const };
  if (coupon.expiresAt && coupon.expiresAt < now) return { label: 'Expired', tone: 'yellow' as const };
  if (maxUses && used >= maxUses) return { label: 'Limit reached', tone: 'slate' as const };
  return { label: 'Active', tone: 'green' as const };
}

export default async function Coupons() {
  await requireUser(['ADMIN']);
  const activeReservationCutoff = new Date();
  activeReservationCutoff.setHours(activeReservationCutoff.getHours() - 2);
  const [coupons, paidUsage, reservedUsage, latestRedemptions, courses, settings] = await Promise.all([
    prisma.coupon.findMany({ include: { instructor: { select: { name: true } } }, orderBy: { code: 'asc' } }),
    prisma.couponRedemption.groupBy({ by: ['couponId'], where: { order: { status: 'PAID' } }, _count: { _all: true } }),
    prisma.couponRedemption.groupBy({ by: ['couponId'], where: { order: { status: 'PENDING', createdAt: { gte: activeReservationCutoff } } }, _count: { _all: true } }),
    prisma.couponRedemption.findMany({ where: { order: { status: 'PAID' } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.course.findMany({ select: { id: true, title: true }, orderBy: { title: 'asc' } }),
    getSiteSettings(),
  ]);
  const paidUsageByCoupon = new Map(paidUsage.map((item) => [item.couponId, item._count._all]));
  const reservedUsageByCoupon = new Map(reservedUsage.map((item) => [item.couponId, item._count._all]));
  const latestByCoupon = new Map<string, Date>();
  for (const redemption of latestRedemptions) {
    if (!latestByCoupon.has(redemption.couponId)) latestByCoupon.set(redemption.couponId, redemption.createdAt);
  }
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Coupons">
      <form className="card mb-6 grid gap-4" action="/api/admin/coupons" method="post">
          <CsrfInput />
        <div className="grid gap-3 md:grid-cols-4">
          <input className="input" name="code" placeholder="Code e.g. LAUNCH40" required />
          <select className="input" name="discountType" defaultValue="PERCENT">
            <option value="PERCENT">Percent discount</option>
            <option value="FIXED">Fixed amount</option>
          </select>
          <input className="input" name="percent" type="number" min="1" max="100" placeholder="Percent, e.g. 25" />
          <input className="input" name="amount" type="number" min="0" step="0.01" placeholder={`Fixed amount (${settings.currency})`} />
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <input className="input" name="startsAt" type="date" aria-label="Start date" />
          <input className="input" name="expiresAt" type="date" aria-label="Expiration date" />
          <input className="input" name="maxUses" type="number" min="0" placeholder="Max uses" />
          <input className="input" name="perUserLimit" type="number" min="0" placeholder="Per user limit" />
          <input className="input" name="minOrderAmount" type="number" min="0" step="0.01" placeholder="Minimum order" />
        </div>

        <div className="border border-[#2F3336] bg-black p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-white">Course scope</h2>
              <p className="mt-1 text-xs text-[#71767B]">Leave all unchecked to apply the coupon to every course.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
              <input type="checkbox" name="active" defaultChecked />
              Active
            </label>
          </div>
          <div className="mt-4 grid max-h-52 gap-2 overflow-auto pr-2 md:grid-cols-2">
            {courses.map((course) => (
              <label className="flex items-center gap-2 rounded-full border border-[#2F3336] px-3 py-2 text-sm font-semibold text-[#E7E9EA]" key={course.id}>
                <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="courseIds" value={course.id} />
                <span className="truncate">{course.title}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="btn-primary w-fit">Save Coupon</button>
      </form>

      <div className="card mb-6">
        <h2 className="text-xl font-bold">Coupon engine</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">
          Coupons now support percentage and fixed discounts, scheduled start dates, expiry dates, global usage caps,
          per-user limits, minimum order values, course-specific scope, and two-hour checkout reservations to protect usage limits.
        </p>
      </div>

      <DataTable
        headers={['Code', 'Owner', 'Discount', 'Status', 'Window', 'Usage', 'Minimum', 'Scope', 'Last used', 'Manage']}
        rows={coupons.map((coupon) => {
          const paidUsed = paidUsageByCoupon.get(coupon.id) || 0;
          const reserved = reservedUsageByCoupon.get(coupon.id) || 0;
          const activeUsed = paidUsed + reserved;
          const status = couponStatus(coupon, activeUsed, coupon.maxUses);
          const scopedIds = fromJsonArray<string>(coupon.courseIds);
          const scope = scopedIds.length ? scopedIds.map((id) => courseTitles.get(id) || id).join(', ') : 'All courses';
          return [
            <span className="font-bold" key="code">{coupon.code}</span>,
            coupon.instructor?.name || 'Platform',
            couponLabel(coupon, settings.currency),
            <Badge key="status" tone={status.tone}>{status.label}</Badge>,
            `${coupon.startsAt?.toLocaleDateString() || 'Now'} - ${coupon.expiresAt?.toLocaleDateString() || 'No expiry'}`,
            coupon.maxUses ? `${activeUsed}/${coupon.maxUses} (${paidUsed} paid, ${reserved} reserved)` : `${paidUsed} paid, ${reserved} reserved`,
            formatMoney(coupon.minOrderAmount, settings.currency),
            <span className="line-clamp-2 max-w-xs" key="scope">{scope}</span>,
            latestByCoupon.get(coupon.id)?.toLocaleString() || '-',
            <div key="manage" className="grid min-w-[420px] gap-3">
              <details>
                <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit coupon</summary>
                <form className="mt-3 grid gap-3" action="/api/admin/coupons" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="update" />
                  <input type="hidden" name="id" value={coupon.id} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="input" name="code" defaultValue={coupon.code} required />
                    <select className="input" name="discountType" defaultValue={coupon.discountType}>
                      <option value="PERCENT">Percent discount</option>
                      <option value="FIXED">Fixed amount</option>
                    </select>
                    <input className="input" name="percent" type="number" min="1" max="100" defaultValue={coupon.percent || ''} placeholder="Percent" />
                    <input className="input" name="amount" type="number" min="0" step="0.01" defaultValue={String(coupon.amount)} placeholder={`Fixed amount (${settings.currency})`} />
                    <input className="input" name="startsAt" type="date" defaultValue={coupon.startsAt?.toISOString().slice(0, 10) || ''} />
                    <input className="input" name="expiresAt" type="date" defaultValue={coupon.expiresAt?.toISOString().slice(0, 10) || ''} />
                    <input className="input" name="maxUses" type="number" min="0" defaultValue={coupon.maxUses || ''} placeholder="Max uses" />
                    <input className="input" name="perUserLimit" type="number" min="0" defaultValue={coupon.perUserLimit || ''} placeholder="Per user limit" />
                    <input className="input" name="minOrderAmount" type="number" min="0" step="0.01" defaultValue={String(coupon.minOrderAmount)} placeholder="Minimum order" />
                  </div>
                  <div className="max-h-44 overflow-auto border border-[#2F3336] p-3">
                    <p className="mb-2 text-xs font-bold uppercase text-[#71767B]">Course scope</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {courses.map((course) => (
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#E7E9EA]" key={course.id}>
                          <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="courseIds" value={course.id} defaultChecked={scopedIds.includes(course.id)} />
                          <span className="truncate">{course.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                    <input type="checkbox" name="active" defaultChecked={coupon.active} />
                    Active
                  </label>
                  <button className="btn-primary w-fit">Save changes</button>
                </form>
              </details>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/coupons" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={coupon.id} />
                  <button className="btn-secondary">{coupon.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/coupons" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={coupon.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200" disabled={activeUsed > 0} title={activeUsed > 0 ? 'Coupons with active history are preserved for reports.' : 'Delete unused coupon'}>
                    {activeUsed > 0 ? 'Has history' : 'Delete'}
                  </button>
                </form>
              </div>
            </div>,
          ];
        })}
      />
    </DashboardShell>
  );
}
