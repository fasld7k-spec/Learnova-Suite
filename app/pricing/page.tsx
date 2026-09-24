export const dynamic = 'force-dynamic';

import { ArrowRight, BadgePercent, Boxes, CheckCircle2, CreditCard, Sparkles } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { fromJsonArray } from '@/lib/json-fields';
import { localizedPageCopy } from '@/lib/page-copy';
import { gatewayLabels, getActivePaymentMethods } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

export default async function Pricing() {
  const [plans, seasonalCourses, bundles, paymentMethods, settings] = await Promise.all([
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { price: 'asc' } }).catch(() => []),
    prisma.course.findMany({
      where: { status: 'PUBLISHED', salePrice: { not: null } },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 3
    }).catch(() => []),
    prisma.courseBundle.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 2 }).catch(() => []),
    getActivePaymentMethods(),
    getSiteSettings()
  ]);
  const copy = localizedPageCopy(settings.defaultLanguage).pricing;

  const displayPlans = plans.length
    ? plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: formatMoney(plan.price, settings.currency),
        interval: plan.interval,
        features: fromJsonArray<string>(plan.features),
        persisted: true
      }))
    : [];

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <div className="page-shell">
        <section className="moe-panel grid gap-6 rounded-xl p-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="text-xs font-black uppercase text-violet-200">{copy.eyebrow}</p>
            <h1 className="moe-gradient-text mt-2 text-5xl font-black leading-tight">{copy.title}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
              {copy.subtitle}
            </p>
          </div>
          <div className="moe-panel-soft grid content-center gap-3 rounded-xl p-5 text-white">
            <span className="moe-mini-icon">
              <Sparkles size={22} />
            </span>
            <b>{copy.flexibleSelling}</b>
            <span className="text-sm font-semibold text-slate-300">{copy.flexibleSellingBody}</span>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-violet-200">{copy.seasonalOffers}</p>
              <h2 className="mt-2 text-3xl font-black text-white">{copy.discountedCourses}</h2>
            </div>
            <a className="moe-control inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-black text-white transition hover:bg-white/10" href="/courses?sort=price-asc">
              {copy.browseCourses}
              <ArrowRight size={17} />
            </a>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {seasonalCourses.length ? seasonalCourses.map((course) => (
              <a className="moe-panel block rounded-xl p-5 transition hover:-translate-y-1 hover:border-violet-300/45" href={`/courses/${course.slug}`} key={course.id}>
                <span className="moe-mini-icon">
                  <BadgePercent size={22} />
                </span>
                <p className="mt-4 text-sm font-bold text-slate-400">{course.category?.nameEn || 'Course'}</p>
                <h3 className="mt-2 line-clamp-2 text-xl font-black">{course.title}</h3>
                <div className="mt-5 flex items-end gap-2">
                  <b className="text-3xl font-black">{formatMoney(course.salePrice, settings.currency)}</b>
                  <span className="pb-1 text-sm font-bold text-slate-500 line-through">{formatMoney(course.price, settings.currency)}</span>
                </div>
              </a>
            )) : (
              <div className="moe-panel rounded-xl p-5 md:col-span-3">
                <p className="font-bold">{copy.noSeasonalOffers}</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <p className="text-xs font-black uppercase text-violet-200">{copy.subscriptions}</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            {displayPlans.length ? displayPlans.map((plan, index) => (
              <div className={`moe-panel relative rounded-xl p-6 ${index === 1 ? 'border-violet-300/60 shadow-[0_26px_90px_rgba(124,60,255,0.24)]' : ''}`} key={plan.id}>
                {index === 1 && <span className="moe-primary absolute right-5 top-5 rounded-lg px-3 py-1 text-xs font-bold text-white">{copy.popular}</span>}
                <span className="moe-mini-icon">
                  <CreditCard size={21} />
                </span>
                <h2 className="mt-5 text-2xl font-black">{plan.name}</h2>
                <div className="mt-4 flex items-end gap-2">
                  <b className="text-5xl font-black">{plan.price}</b>
                  <span className="pb-2 text-sm font-bold text-slate-400">/{plan.interval}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-400">
                  One-time checkout for membership access. Sandbox mode does not create recurring gateway billing.
                </p>
                <ul className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm font-medium text-white">
                      <CheckCircle2 size={18} className="shrink-0 text-violet-200" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.persisted ? (
                  <form action="/api/subscriptions/checkout" method="post" className="mt-7 grid gap-3">
                    <CsrfInput />
                    <input type="hidden" name="planId" value={plan.id} />
                    <select className="input" name="gateway" aria-label="Payment method">
                      {paymentMethods.map((method: any) => (
                        <option key={method.slug} value={method.slug}>
                          {gatewayLabels[method.slug] || method.name}
                        </option>
                      ))}
                    </select>
                    <button className="moe-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-black transition">
                      {copy.startPlan}
                      <ArrowRight size={17} />
                    </button>
                  </form>
                ) : (
                  <button className="moe-control mt-7 inline-flex h-11 w-full items-center justify-center text-sm font-black text-slate-400" disabled>
                    {copy.configureInAdmin}
                  </button>
                )}
              </div>
            )) : (
              <div className="moe-panel rounded-xl p-6 text-center lg:col-span-3">
                <span className="moe-mini-icon mx-auto">
                  <CreditCard size={22} />
                </span>
                <h2 className="mt-4 text-2xl font-black text-white">No subscription plans configured yet</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Membership pricing will appear here after active subscription plans are added.
                </p>
                <a className="moe-primary mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-black text-white" href="/courses">
                  Browse courses
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-violet-200">{copy.bundles}</p>
              <h2 className="mt-2 text-3xl font-black text-white">{copy.packagedPaths}</h2>
            </div>
            <a className="moe-control inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-black text-white transition hover:bg-white/10" href="/bundles">
              {copy.viewBundles}
              <ArrowRight size={17} />
            </a>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {bundles.length ? bundles.map((bundle) => (
              <div className="moe-panel rounded-xl p-5" key={bundle.id}>
                <span className="moe-mini-icon">
                  <Boxes size={22} />
                </span>
                <h3 className="mt-4 text-2xl font-black">{bundle.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{bundle.description}</p>
                <b className="mt-5 block text-3xl font-black">{formatMoney(bundle.price, settings.currency)}</b>
              </div>
            )) : (
              <div className="moe-panel rounded-xl p-5 md:col-span-2">
                <p className="font-bold">{copy.noBundles}</p>
              </div>
            )}
          </div>
        </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
