export const dynamic = 'force-dynamic';

import { Rocket, Sparkles } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function Updates() {
  const rows = await prisma.productUpdate.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <Rocket size={23} />
            </span>
            <h1 className="mt-5 text-5xl font-black text-white">Product Updates</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              A polished release timeline for buyers, admins, instructors, and students.
            </p>
          </div>
        </section>

        <section className="page-shell mt-8 grid gap-5">
          {rows.length ? rows.map((update) => (
            <article className="moe-panel moe-card-shine p-5" key={update.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-violet-200">
                    <Sparkles size={15} />
                    v{update.version}
                  </p>
                  <h2 className="mt-3 text-2xl font-black text-white">{update.title}</h2>
                </div>
                <span className="rounded-md border border-violet-300/20 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                  Published
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{update.body}</p>
            </article>
          )) : (
            <div className="moe-panel p-6 text-center">
              <span className="moe-mini-icon mx-auto">
                <Rocket size={22} />
              </span>
              <h2 className="mt-4 text-2xl font-black text-white">No product updates published yet</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Release notes will appear here after product updates are published.
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
