export const dynamic = 'force-dynamic';

import { ArrowUpRight, Handshake, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';

export default async function PublicPartners() {
  const now = new Date();
  const [partners, offers, sponsorships] = await Promise.all([
    prisma.partner.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
    prisma.partnerOffer.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.sponsorship.findMany({
      where: {
        active: true,
        placement: { in: ['partners', 'partner', 'public'] },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h1 className="text-5xl font-black text-white">Partners</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">A curated network of learning, hiring, and ecosystem partners connected to the marketplace experience.</p>
          </div>
          <div className="moe-panel p-5 text-white">
            <Sparkles size={22} />
            <p className="mt-4 text-sm font-bold">Partner profiles can drive traffic to offers, sponsorships, and trusted learning pathways.</p>
          </div>
        </div>
        </section>

        {sponsorships.length ? (
          <section className="page-shell mt-8 grid gap-4 md:grid-cols-3">
            {sponsorships.map((item) => {
              const content = (
                <>
                  {item.imageUrl ? <Image unoptimized className="h-12 w-12 object-contain" src={item.imageUrl} alt="" width={48} height={48} /> : <Sparkles size={22} />}
                  <p className="mt-4 text-xs font-bold uppercase text-violet-200">Sponsored</p>
                  <h2 className="mt-2 text-xl font-black text-white">{item.sponsor}</h2>
                </>
              );
              return item.targetUrl ? (
                <a key={item.id} className="moe-panel p-5 transition hover:-translate-y-0.5" href={item.targetUrl}>
                  {content}
                </a>
              ) : (
                <article key={item.id} className="moe-panel p-5">
                  {content}
                </article>
              );
            })}
          </section>
        ) : null}

        {offers.length ? (
          <section className="page-shell mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-violet-200">Partner offers</p>
                <h2 className="mt-1 text-3xl font-black text-white">Current ecosystem perks</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {offers.map((offer) => {
                const partner = partnerById.get(offer.partnerId);
                const content = (
                  <>
                    <p className="text-xs font-bold uppercase text-slate-400">{partner?.name || 'Partner offer'}</p>
                    <h3 className="mt-3 text-xl font-black text-white">{offer.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{offer.description}</p>
                    {offer.url ? (
                      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-200">
                        View offer
                        <ArrowUpRight size={16} />
                      </span>
                    ) : null}
                  </>
                );
                return offer.url ? (
                  <a key={offer.id} className="moe-panel moe-card-shine p-5 transition hover:-translate-y-0.5" href={offer.url}>
                    {content}
                  </a>
                ) : (
                  <article key={offer.id} className="moe-panel p-5">
                    {content}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {partners.length ? partners.map((partner) => partner.website ? (
            <a className="moe-panel moe-card-shine group p-5 transition hover:-translate-y-0.5" key={partner.id} href={partner.website} target="_blank" rel="noreferrer">
              <span className="moe-mini-icon h-12 w-12">
                <Handshake size={23} />
              </span>
              <h2 className="mt-5 text-2xl font-black text-white">{partner.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Trusted learning partner</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition group-hover:gap-3">
                Visit partner
                <ArrowUpRight size={16} />
              </span>
            </a>
          ) : (
            <article className="moe-panel p-5" key={partner.id}>
              <span className="moe-mini-icon h-12 w-12">
                <Handshake size={23} />
              </span>
              <h2 className="mt-5 text-2xl font-black text-white">{partner.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Trusted learning partner</p>
              <span className="mt-6 inline-flex text-sm font-bold text-slate-400">Website not added yet</span>
            </article>
          )) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No partners published" description="Approved partners will appear here when they are activated from the admin dashboard." />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
