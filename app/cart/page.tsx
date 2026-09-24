import Link from 'next/link';
import { ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { validateCouponForCheckout } from '@/lib/coupons';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { localizedPageCopy } from '@/lib/page-copy';
import { gatewayLabels, getActivePaymentMethods } from '@/lib/payment-gateways';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

const courseAmount = (course: { isFree: boolean; salePrice: unknown; price: unknown }) => course.isFree ? 0 : Number(course.salePrice ?? course.price ?? 0);

export default async function CartPage(props: { searchParams?: Promise<{ coupon?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT', 'ADMIN']);
  const requestedCoupon = String(searchParams?.coupon || '').trim().toUpperCase();
  const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
  const courses = cart?.items.length ? await prisma.course.findMany({ where: { id: { in: cart.items.map((item) => item.courseId) } }, include: { instructor: true, category: true } }) : [];
  const [paymentMethods, settings] = await Promise.all([getActivePaymentMethods(), getSiteSettings()]);
  const copy = localizedPageCopy(settings.defaultLanguage).cart;
  const lines = courses.map((course) => ({ courseId: course.id, amount: courseAmount(course) }));
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const couponPreview = requestedCoupon ? await validateCouponForCheckout({ code: requestedCoupon, userId: user.id, lines }) : null;
  const discount = couponPreview?.valid ? couponPreview.discount : 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <>
      <Nav />
      <main className="moe-page py-10">
        <section className="page-shell">
          <div className="moe-panel rounded-xl p-5 sm:p-6">
            <span className="moe-mini-icon">
              <ShoppingCart size={23} />
            </span>
            <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl">{copy.title}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">{copy.subtitle}</p>
          </div>
        </section>

        {courses.length ? (
          <div className="page-shell mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4">
              {courses.map((course) => (
                <div className="moe-panel rounded-xl p-4 transition hover:-translate-y-1 hover:border-violet-300/45 sm:p-5" key={course.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">{course.category?.nameEn || copy.course}</p>
                      <h2 className="mt-2 line-clamp-2 text-xl font-black text-white">{course.title}</h2>
                      <p className="mt-1 text-sm text-slate-400">{course.instructor.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 sm:block sm:text-right">
                      <b className="text-2xl font-black text-white">{course.isFree ? copy.free : formatMoney(course.salePrice ?? course.price, settings.currency)}</b>
                      <form action="/api/cart/remove" method="post" className="mt-2">
                        <CsrfInput />
                        <input type="hidden" name="courseId" value={course.id} />
                        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-bold text-rose-300 hover:bg-rose-500/10" aria-label={`${copy.removeFromCart}: ${course.title}`}>
                          <Trash2 size={14} />
                          {copy.remove}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="moe-panel h-fit rounded-xl p-5 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-4">
                <span className="text-lg font-black text-white">{copy.subtotal}</span>
                <b className="text-3xl font-black text-white">{formatMoney(subtotal, settings.currency)}</b>
              </div>
              <form action="/cart" method="get" className="mt-6 grid gap-3">
                <label>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{copy.couponCode}</span>
                  <input className="moe-control h-12 w-full px-4 text-sm font-semibold" name="coupon" defaultValue={requestedCoupon} placeholder="WELCOME25" />
                </label>
                <button className="moe-control h-11 w-full text-sm font-black text-white" type="submit">{copy.applyCoupon}</button>
              </form>
              {couponPreview && (
                <div className={`mt-3 rounded-[8px] border p-3 text-sm font-semibold ${couponPreview.valid ? 'border-[#00BA7C]/50 bg-[#00BA7C]/10 text-[#5EE4B3]' : 'border-[#FFD400]/40 bg-[#FFD400]/10 text-[#FFE36E]'}`}>
                  {couponPreview.valid ? `${copy.couponApplied}: ${couponPreview.code}` : `${copy.couponNotApplied}: ${couponPreview.reason}`}
                </div>
              )}
              <div className="mt-5 grid gap-3 border-y border-violet-300/15 py-5 text-sm">
                <p className="flex items-center justify-between gap-4 text-slate-400">
                  <span>{copy.subtotal}</span>
                  <b className="text-white">{formatMoney(subtotal, settings.currency)}</b>
                </p>
                <p className="flex items-center justify-between gap-4 text-slate-400">
                  <span>{copy.discount}</span>
                  <b className={discount ? 'text-[#00BA7C]' : 'text-white'}>-{formatMoney(discount, settings.currency)}</b>
                </p>
                <p className="flex items-center justify-between gap-4 text-base font-black text-white">
                  <span>{copy.total}</span>
                  <b className="text-3xl">{formatMoney(total, settings.currency)}</b>
                </p>
              </div>
              <form action="/api/cart/checkout" method="post" className="mt-5 grid gap-3">
                <CsrfInput />
                {couponPreview?.valid && <input type="hidden" name="couponCode" value={couponPreview.code} />}
                <label>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{copy.paymentMethod}</span>
                  <select className="moe-control h-12 w-full px-4 text-sm font-semibold" name="gateway">
                    {paymentMethods.map((method: any) => (
                      <option key={method.slug} value={method.slug}>
                        {gatewayLabels[method.slug] || method.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="moe-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-black">
                  {copy.checkout}
                  <ArrowRight size={17} />
                </button>
              </form>
              <div className="mt-5 border-t border-violet-300/15 pt-4 text-xs leading-6 text-slate-400">
                {copy.notes}
              </div>
            </aside>
          </div>
        ) : (
          <div className="page-shell mt-8">
            <EmptyState
              title={copy.emptyTitle}
              description={copy.emptyBody}
              action={<Link className="btn-primary" href="/courses">{copy.browseCourses}</Link>}
            />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
