export const dynamic = 'force-dynamic';

import { ArrowRight, CalendarClock, CheckCircle2, CreditCard, Sparkles } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { fromJsonArray } from '@/lib/json-fields';
import { gatewayLabels, getActivePaymentMethods } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

export default async function Subscriptions() {
  const [plans, paymentMethods, settings] = await Promise.all([
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { price: 'asc' } }),
    getActivePaymentMethods(),
    getSiteSettings()
  ]);
  const displayPlans = plans.length
    ? plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: formatMoney(plan.price, settings.currency),
        interval: plan.interval,
        features: fromJsonArray<string>(plan.features),
        persisted: true
      }))
    : [
        { id: 'starter', name: 'Starter', price: formatMoney(19, settings.currency), interval: 'monthly', features: ['Course access', 'Certificates', 'Live sessions'], persisted: false },
        { id: 'growth', name: 'Growth', price: formatMoney(49, settings.currency), interval: 'monthly', features: ['Team learning', 'Instructor tools', 'Advanced analytics'], persisted: false },
        { id: 'academy', name: 'Academy', price: formatMoney(99, settings.currency), interval: 'monthly', features: ['Marketplace suite', 'Priority support', 'Custom operations'], persisted: false }
      ];

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid gap-8 p-6 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Memberships</p>
            <h1 className="mt-2 text-5xl font-black text-white">Membership Access Plans</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Package courses, live learning, certificates, and community access into clear membership access periods.
            </p>
          </div>
          <div className="moe-panel p-5 text-white">
            <Sparkles size={22} className="text-violet-300" />
            <p className="mt-4 text-sm font-bold">Sandbox checkout creates one-time access orders. It does not start recurring gateway billing unless you add a production subscription integration.</p>
          </div>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 lg:grid-cols-3">
          {displayPlans.map((plan, index) => (
            <div className={`moe-panel moe-card-shine relative p-5 ${index === 1 ? 'border-violet-400/50 shadow-[0_18px_50px_rgba(124,60,255,0.18)]' : ''}`} key={plan.id}>
              {index === 1 && <span className="absolute right-5 top-5 rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">Popular</span>}
              <CreditCard size={22} className="text-violet-300" />
              <h2 className="mt-5 text-2xl font-black">{plan.name}</h2>
              <div className="mt-4 flex items-end gap-2">
                <b className="text-5xl font-black">{plan.price}</b>
                <span className="pb-2 text-sm font-bold text-slate-400">/{plan.interval}</span>
              </div>
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                <CalendarClock size={16} />
                {plan.interval === 'yearly' ? '12 months of access after payment' : '1 month of access after payment'}
              </p>
              <ul className="mt-6 grid gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm font-medium text-white">
                    <CheckCircle2 size={18} className="shrink-0 text-[#00BA7C]" />
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
                  <button className="moe-primary w-full justify-center px-5 py-3">
                    Start plan
                    <ArrowRight size={17} />
                  </button>
                </form>
              ) : (
                <button className="moe-control mt-7 h-11 w-full text-sm font-bold text-slate-400" disabled>
                  Configure in admin
                </button>
              )}
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
