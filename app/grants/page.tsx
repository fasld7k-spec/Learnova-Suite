export const dynamic = 'force-dynamic';

import { ArrowRight, FileText, HandCoins } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';

export default async function PublicGrants() {
  const grants = await prisma.grantProgram.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">Grant Programs</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Support learner access with structured grant applications and review-ready statements.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-5">
          {grants.length ? grants.map((grant) => (
            <div className="moe-panel moe-card-shine p-5" key={grant.id}>
              <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
                <div>
                  <span className="moe-mini-icon">
                    <HandCoins size={22} />
                  </span>
                  <h2 className="mt-5 text-2xl font-black text-white">{grant.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{grant.description}</p>
                </div>
                <form className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-4" action="/api/grants/apply" method="post">
                  <CsrfInput />
                  <input type="hidden" name="grantId" value={grant.id} />
                  <label className="text-sm font-bold text-slate-200">
                    <span className="mb-2 inline-flex items-center gap-2">
                      <FileText size={16} />
                      Application statement
                    </span>
                    <textarea className="input min-h-32" name="statement" placeholder="Why should you receive this grant?" />
                  </label>
                  <button className="moe-primary mt-3 px-5 py-3">
                    Apply
                    <ArrowRight size={17} />
                  </button>
                </form>
              </div>
            </div>
          )) : (
            <EmptyState title="No grant programs" description="Active grant programs will appear here when published." />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
