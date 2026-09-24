export const dynamic = 'force-dynamic';

import { ArrowRight, MessageCircleHeart, Timer } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';

const money = (value: unknown) => Number(value || 0).toFixed(2);

export default async function Mentorship() {
  const rows = await prisma.mentorProgram.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">Mentorship Programs</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Pair learners with expert guidance, office hours, and structured accountability programs.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rows.length ? rows.map((program) => (
            <div className="moe-panel moe-card-shine p-5" key={program.id}>
              <span className="moe-mini-icon h-12 w-12">
                <MessageCircleHeart size={23} />
              </span>
              <h2 className="mt-5 text-2xl font-black text-white">{program.title}</h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{program.description}</p>
              <div className="mt-6 flex items-center justify-between gap-4 border-t border-violet-300/15 pt-5">
                <b className="text-4xl font-black">${money(program.price)}</b>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-slate-400">
                  <Timer size={16} />
                  Program
                </span>
              </div>
              <form className="mt-6" action="/api/mentorship/enroll" method="post">
                <CsrfInput />
                <input type="hidden" name="programId" value={program.id} />
                <button className="moe-primary w-full justify-center px-5 py-3">
                  Enroll
                  <ArrowRight size={17} />
                </button>
              </form>
            </div>
          )) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No mentorship programs" description="Mentorship programs will appear here when instructors publish them." />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
