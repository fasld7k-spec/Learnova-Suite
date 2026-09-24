export const dynamic = 'force-dynamic';

import { ArrowRight, BriefcaseBusiness, FileText, MapPin } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';

export default async function Jobs() {
  const jobs = await prisma.jobBoardPost.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">Jobs Board</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Connect learners with relevant roles, apprenticeships, and hiring opportunities from the education ecosystem.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-5">
          {jobs.length ? jobs.map((job) => (
            <div className="moe-panel moe-card-shine p-5" key={job.id}>
              <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
                <div>
                  <span className="moe-mini-icon">
                    <BriefcaseBusiness size={22} />
                  </span>
                  <h2 className="mt-5 text-2xl font-black text-white">{job.title}</h2>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                    <MapPin size={15} />
                    {job.company} / {job.location || 'Remote'}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{job.description}</p>
                </div>
                <form action="/api/jobs/apply" method="post" className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-4">
                  <CsrfInput />
                  <input type="hidden" name="jobId" value={job.id} />
                  <label className="text-sm font-bold text-slate-200">
                    <span className="mb-2 inline-flex items-center gap-2">
                      <FileText size={16} />
                      Cover note
                    </span>
                    <textarea className="input min-h-32" name="coverNote" placeholder="Cover note" />
                  </label>
                  <button className="moe-primary mt-3 px-5 py-3">
                    Apply
                    <ArrowRight size={17} />
                  </button>
                </form>
              </div>
            </div>
          )) : (
            <EmptyState title="No active jobs" description="New job opportunities will appear here when published." />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
