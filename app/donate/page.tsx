export const dynamic = 'force-dynamic';

import { ArrowRight, Goal, HeartHandshake, MessageSquare } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { gatewayLabels, getActivePaymentMethods } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';

const money = (value: unknown) => Number(value || 0).toFixed(2);

export default async function Donate() {
  const rows = await prisma.donationCampaign.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  const paymentMethods = await getActivePaymentMethods();

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">Support Learning</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Fund learning campaigns, community access, and education initiatives through simple donation flows.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-5">
          {rows.length ? rows.map((campaign) => (
            <div className="moe-panel moe-card-shine p-5" key={campaign.id}>
              <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
                <div>
                  <span className="moe-mini-icon">
                    <HeartHandshake size={22} />
                  </span>
                  <h2 className="mt-5 text-2xl font-black text-white">{campaign.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{campaign.description}</p>
                  <p className="mt-5 inline-flex items-center gap-2 rounded-md border border-violet-300/20 bg-white/5 px-3 py-2 text-sm font-black text-slate-200">
                    <Goal size={16} />
                    Goal: ${money(campaign.goal)}
                  </p>
                </div>
                <form className="grid gap-3 rounded-lg border border-violet-300/15 bg-white/[0.04] p-4" action="/api/donate" method="post">
                  <CsrfInput />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <input className="input" name="donorName" placeholder="Name optional" />
                  <input className="input" name="amount" type="number" step="0.01" placeholder="Amount" />
                  <select className="input" name="gateway" defaultValue={paymentMethods[0]?.slug || 'manual'}>
                    {paymentMethods.map((method: any) => (
                      <option key={method.slug} value={method.slug}>
                        {method.name || gatewayLabels[method.slug] || method.slug}
                      </option>
                    ))}
                  </select>
                  <label className="relative">
                    <MessageSquare size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
                    <textarea className="input min-h-28 pl-10" name="message" placeholder="Message" />
                  </label>
                  <button className="moe-primary w-fit px-5 py-3">
                    Donate
                    <ArrowRight size={17} />
                  </button>
                </form>
              </div>
            </div>
          )) : (
            <EmptyState title="No donation campaigns" description="Active campaigns will appear here when published." />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
