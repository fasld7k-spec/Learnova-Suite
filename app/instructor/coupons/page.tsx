import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { CopyLink } from '@/components/dashboard/CopyLink';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { couponLabel } from '@/lib/coupons';
import { fromJsonArray } from '@/lib/json-fields';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

function couponStatus(coupon: { active: boolean; startsAt: Date | null; expiresAt: Date | null }, used: number, maxUses?: number | null) {
  const now = new Date();
  if (!coupon.active) return { label: 'Paused', tone: 'slate' as const };
  if (coupon.startsAt && coupon.startsAt > now) return { label: 'Scheduled', tone: 'yellow' as const };
  if (coupon.expiresAt && coupon.expiresAt < now) return { label: 'Expired', tone: 'red' as const };
  if (maxUses && used >= maxUses) return { label: 'Limit reached', tone: 'yellow' as const };
  return { label: 'Active', tone: 'green' as const };
}

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '';
}

export default async function InstructorCoupons() {
  const user = await requireUser(['INSTRUCTOR']);
  const activeReservationCutoff = new Date();
  activeReservationCutoff.setHours(activeReservationCutoff.getHours() - 2);
  const [courses, coupons, paidUsage, reservedUsage, redemptions, settings] = await Promise.all([
    prisma.course.findMany({ where: { instructorId: user.id }, select: { id: true, title: true, slug: true, status: true }, orderBy: { title: 'asc' } }),
    prisma.coupon.findMany({ where: { instructorId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.couponRedemption.groupBy({ by: ['couponId'], where: { order: { status: 'PAID' } }, _count: { _all: true } }),
    prisma.couponRedemption.groupBy({ by: ['couponId'], where: { order: { status: 'PENDING', createdAt: { gte: activeReservationCutoff } } }, _count: { _all: true } }),
    prisma.couponRedemption.findMany({
      where: { coupon: { instructorId: user.id }, order: { status: 'PAID' } },
      include: {
        coupon: true,
        user: { select: { name: true, email: true } },
        order: { include: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    getSiteSettings(),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const courseSlugs = new Map(courses.map((course) => [course.id, course.slug]));
  const paidUsageByCoupon = new Map(paidUsage.map((item) => [item.couponId, item._count._all]));
  const reservedUsageByCoupon = new Map(reservedUsage.map((item) => [item.couponId, item._count._all]));
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);

  return (
    <DashboardShell role="instructor" title="Coupons">
      <form className="card mb-6 grid gap-4" action="/api/instructor/coupons" method="post">
        <CsrfInput />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">{t('Create instructor coupon')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
              {t('Coupons created here apply only to your courses. Admins can still audit usage and pause marketplace campaigns globally.')}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked />
            {t('Active')}
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <input className="input" name="code" placeholder={t('Code e.g. MYSALE20')} required />
          <select className="input" name="discountType" defaultValue="PERCENT">
            <option value="PERCENT">{t('Percent discount')}</option>
            <option value="FIXED">{t('Fixed amount')}</option>
          </select>
          <input className="input" name="percent" type="number" min="1" max="90" placeholder={t('Percent, e.g. 20')} />
          <input className="input" name="amount" type="number" min="0" step="0.01" placeholder={`${t('Fixed amount')} (${settings.currency})`} />
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <input className="input" name="startsAt" type="date" aria-label={t('Start date')} />
          <input className="input" name="expiresAt" type="date" aria-label={t('Expiration date')} />
          <input className="input" name="maxUses" type="number" min="0" placeholder={t('Max uses')} />
          <input className="input" name="perUserLimit" type="number" min="0" placeholder={t('Per user limit')} />
          <input className="input" name="minOrderAmount" type="number" min="0" step="0.01" placeholder={t('Minimum order')} />
        </div>

        <div className="border border-[#2F3336] bg-black p-4">
          <h3 className="text-sm font-black text-white">{t('Apply to courses')}</h3>
          <p className="mt-1 text-xs text-[#71767B]">{t('Choose at least one course. Draft courses can have coupons ready before publishing.')}</p>
          <div className="mt-4 grid max-h-56 gap-2 overflow-auto pr-2 md:grid-cols-2">
            {courses.map((course) => (
              <label className="flex items-center gap-2 rounded-full border border-[#2F3336] px-3 py-2 text-sm font-semibold text-[#E7E9EA]" key={course.id}>
                <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="courseIds" value={course.id} />
                <span className="min-w-0 flex-1 truncate">{course.title}</span>
                <span className="text-xs text-[#71767B]">{course.status}</span>
              </label>
            ))}
          </div>
        </div>

        <button className="btn-primary w-fit" disabled={!courses.length}>
          {t('Save Coupon')}
        </button>
      </form>

      <DataTable
        headers={['Code', 'Discount', 'Status', 'Window', 'Usage', 'Minimum', 'Courses', 'Share link', 'Actions'].map(t)}
        rows={coupons.map((coupon) => {
          const paidUsed = paidUsageByCoupon.get(coupon.id) || 0;
          const reserved = reservedUsageByCoupon.get(coupon.id) || 0;
          const activeUsed = paidUsed + reserved;
          const status = couponStatus(coupon, activeUsed, coupon.maxUses);
          const scopedIds = fromJsonArray<string>(coupon.courseIds);
          const firstCourseSlug = scopedIds.map((id) => courseSlugs.get(id)).find(Boolean);
          const shareHref = firstCourseSlug ? `/courses/${firstCourseSlug}?coupon=${encodeURIComponent(coupon.code)}` : '';
          return [
            <span className="font-bold" key="code">{coupon.code}</span>,
            couponLabel(coupon, settings.currency),
            <Badge key="status" tone={status.tone}>{t(status.label)}</Badge>,
            `${coupon.startsAt?.toLocaleDateString() || t('Now')} - ${coupon.expiresAt?.toLocaleDateString() || t('No expiry')}`,
            coupon.maxUses ? `${activeUsed}/${coupon.maxUses}` : `${paidUsed} ${t('paid')}, ${reserved} ${t('reserved')}`,
            formatMoney(coupon.minOrderAmount, settings.currency),
            <span className="line-clamp-2 max-w-sm" key="courses">{scopedIds.map((id) => courseTitles.get(id) || id).join(', ') || t('No courses selected')}</span>,
            shareHref ? <CopyLink key="share" value={shareHref} label={t('Copy')} copiedLabel={t('Copied')} ariaLabel={t('Coupon share link')} /> : '-',
            <form action="/api/instructor/coupons/status" method="post" key="action">
              <CsrfInput />
              <input type="hidden" name="couponId" value={coupon.id} />
              <input type="hidden" name="action" value={coupon.active ? 'pause' : 'activate'} />
              <button className="btn-secondary min-h-9 px-3">
                {coupon.active ? t('Pause') : t('Activate')}
              </button>
            </form>,
          ];
        })}
      />

      {coupons.length ? (
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-white">{t('Edit coupons')}</h2>
            <p className="mt-1 text-sm text-[#71767B]">{t('Update discount value, dates, usage limits, minimum order, and course scope without recreating the coupon.')}</p>
          </div>
          <div className="grid gap-4">
            {coupons.map((coupon) => {
              const scopedIds = new Set(fromJsonArray<string>(coupon.courseIds));
              return (
                <details key={coupon.id} className="border border-[#2F3336] bg-black p-4">
                  <summary className="cursor-pointer text-base font-black text-white">{coupon.code} - {couponLabel(coupon, settings.currency)}</summary>
                  <form className="mt-4 grid gap-4" action="/api/instructor/coupons" method="post">
                    <CsrfInput />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <input className="input max-w-xs" name="code" defaultValue={coupon.code} readOnly />
                      <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                        <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked={coupon.active} />
                        {t('Active')}
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <select className="input" name="discountType" defaultValue={coupon.discountType}>
                        <option value="PERCENT">{t('Percent discount')}</option>
                        <option value="FIXED">{t('Fixed amount')}</option>
                      </select>
                      <input className="input" name="percent" type="number" min="1" max="90" defaultValue={coupon.percent || ''} placeholder={t('Percent, e.g. 20')} />
                      <input className="input" name="amount" type="number" min="0" step="0.01" defaultValue={Number(coupon.amount || 0) || ''} placeholder={`${t('Fixed amount')} (${settings.currency})`} />
                      <input className="input" name="minOrderAmount" type="number" min="0" step="0.01" defaultValue={Number(coupon.minOrderAmount || 0)} placeholder={t('Minimum order')} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <input className="input" name="startsAt" type="date" defaultValue={dateInputValue(coupon.startsAt)} aria-label={t('Start date')} />
                      <input className="input" name="expiresAt" type="date" defaultValue={dateInputValue(coupon.expiresAt)} aria-label={t('Expiration date')} />
                      <input className="input" name="maxUses" type="number" min="0" defaultValue={coupon.maxUses || ''} placeholder={t('Max uses')} />
                      <input className="input" name="perUserLimit" type="number" min="0" defaultValue={coupon.perUserLimit || ''} placeholder={t('Per user limit')} />
                    </div>
                    <div className="border border-[#2F3336] bg-[#050505] p-4">
                      <h3 className="text-sm font-black text-white">{t('Apply to courses')}</h3>
                      <div className="mt-4 grid max-h-56 gap-2 overflow-auto pr-2 md:grid-cols-2">
                        {courses.map((course) => (
                          <label className="flex items-center gap-2 rounded-full border border-[#2F3336] px-3 py-2 text-sm font-semibold text-[#E7E9EA]" key={course.id}>
                            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="courseIds" value={course.id} defaultChecked={scopedIds.has(course.id)} />
                            <span className="min-w-0 flex-1 truncate">{course.title}</span>
                            <span className="text-xs text-[#71767B]">{course.status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button className="btn-primary w-fit">{t('Update Coupon')}</button>
                  </form>
                </details>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white">{t('Recent coupon usage')}</h2>
            <p className="mt-1 text-sm text-[#71767B]">{t('Latest students and orders that used your instructor coupons.')}</p>
          </div>
          <Badge tone="blue">{redemptions.length} {t('recent')}</Badge>
        </div>
        <DataTable
          headers={['Coupon', 'Student', 'Order', 'Courses', 'Order total', 'Date'].map(t)}
          rows={redemptions.map((redemption) => [
            <span className="font-bold" key="coupon">{redemption.coupon.code}</span>,
            <span key="student">{redemption.user?.name || redemption.user?.email || redemption.userId}</span>,
            redemption.order?.invoiceNumber || redemption.orderId || '-',
            <span className="line-clamp-2 max-w-sm" key="items">{redemption.order?.items.map((item) => item.title).join(', ') || '-'}</span>,
            redemption.order ? formatMoney(redemption.order.total, settings.currency) : '-',
            redemption.createdAt.toLocaleString(),
          ])}
        />
      </section>
    </DashboardShell>
  );
}
