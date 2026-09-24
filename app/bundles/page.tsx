export const dynamic = 'force-dynamic';

import { ArrowRight, Boxes, CheckCircle2, Layers3 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { fromJsonArray } from '@/lib/json-fields';
import { gatewayLabels, getActivePaymentMethods } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

export default async function Bundles() {
  const [bundles, paymentMethods, settings] = await Promise.all([
    prisma.courseBundle.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
    getActivePaymentMethods(),
    getSiteSettings()
  ]);
  const courseIds = Array.from(new Set(bundles.flatMap((bundle) => fromJsonArray<string>(bundle.courseIds))));
  const courses = courseIds.length
    ? await prisma.course.findMany({
        where: { id: { in: courseIds }, status: 'PUBLISHED' },
        include: { category: true },
        orderBy: { createdAt: 'desc' }
      })
    : [];
  const courseById = new Map(courses.map((course) => [course.id, course]));

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Bundles</p>
            <h1 className="mt-2 text-5xl font-black text-white">Course Bundles</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Package related courses into higher-value learning offers with one checkout path and invoice-ready order items.
            </p>
          </div>
          <div className="moe-panel p-5 text-white">
            <Layers3 size={24} className="text-violet-300" />
            <p className="mt-4 text-sm font-bold">Each bundle shows the actual courses included so buyers can verify the learning path before checkout.</p>
          </div>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {bundles.length ? bundles.map((bundle) => {
            const includedCourses = fromJsonArray<string>(bundle.courseIds)
              .map((courseId) => courseById.get(courseId))
              .filter(Boolean);
            const listPrice = includedCourses.reduce((sum, course) => sum + Number(course?.salePrice ?? course?.price ?? 0), 0);
            const savings = Math.max(0, listPrice - Number(bundle.price || 0));

            return (
              <div className="moe-panel moe-card-shine p-5" key={bundle.id}>
                <span className="moe-mini-icon h-12 w-12">
                  <Boxes size={23} />
                </span>
                <h2 className="mt-5 text-2xl font-black text-white">{bundle.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{bundle.description}</p>
                <div className="mt-6 flex flex-wrap items-end gap-2">
                  <b className="text-4xl font-black">{formatMoney(bundle.price, settings.currency)}</b>
                  {savings > 0 && <span className="pb-1 text-sm font-bold text-[#00BA7C]">Save {formatMoney(savings, settings.currency)}</span>}
                </div>
                <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                  <CheckCircle2 size={16} className="text-[#00BA7C]" />
                  {includedCourses.length} courses included
                </p>
                <ul className="mt-4 grid gap-2">
                  {includedCourses.map((course) => course && (
                    <li className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-3 text-sm font-semibold text-white" key={course.id}>
                      {course.title}
                    </li>
                  ))}
                </ul>
                <form className="mt-6 grid gap-3" action="/api/bundles/checkout" method="post">
                  <CsrfInput />
                  <input type="hidden" name="bundleId" value={bundle.id} />
                  <select className="input" name="gateway" aria-label="Payment method">
                    {paymentMethods.map((method: any) => (
                      <option key={method.slug} value={method.slug}>
                        {gatewayLabels[method.slug] || method.name}
                      </option>
                    ))}
                  </select>
                  <button className="moe-primary w-full justify-center px-5 py-3">
                    Buy Bundle
                    <ArrowRight size={17} />
                  </button>
                </form>
              </div>
            );
          }) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No active bundles" description="Course bundles will appear here when they are activated." />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
