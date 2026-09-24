export const dynamic = 'force-dynamic';

import { ArrowRight, FileText, GraduationCap, Percent } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';

export default async function PublicScholarships() {
  const rows = await prisma.scholarship.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">Scholarships</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Offer discounts and funded access to learners who need support reaching the next milestone.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-5">
          {rows.length ? rows.map((scholarship) => (
            <div className="moe-panel moe-card-shine p-5" key={scholarship.id}>
              <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
                <div>
                  <span className="moe-mini-icon">
                    <GraduationCap size={22} />
                  </span>
                  <h2 className="mt-5 text-2xl font-black text-white">{scholarship.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{scholarship.description}</p>
                  <p className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-black text-emerald-200">
                    <Percent size={16} />
                    {scholarship.percent}% discount
                  </p>
                </div>
                <form className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-4" action="/api/scholarships/apply" method="post">
                  <CsrfInput />
                  <input type="hidden" name="scholarshipId" value={scholarship.id} />
                  <label className="text-sm font-bold text-slate-200">
                    <span className="mb-2 inline-flex items-center gap-2">
                      <FileText size={16} />
                      Application statement
                    </span>
                    <textarea className="input min-h-32" name="statement" placeholder="Application statement" />
                  </label>
                  <button className="moe-primary mt-3 px-5 py-3">
                    Apply
                    <ArrowRight size={17} />
                  </button>
                </form>
              </div>
            </div>
          )) : (
            <EmptyState title="No scholarships available" description="Active scholarships will appear here when published." />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
