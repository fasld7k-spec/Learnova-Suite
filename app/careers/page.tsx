export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Target } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function Careers() {
  const tracks = await prisma.careerTrack.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">Career Tracks</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Connect courses to job-ready skill maps, milestones, and portfolio outcomes.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tracks.length ? tracks.map((track) => {
            const skillCount = fromJsonArray<string>(track.skillIds).length;
            return (
              <Link className="moe-panel moe-card-shine group p-5 transition hover:-translate-y-0.5" key={track.id} href={`/careers/${track.slug}`}>
                <div className="flex items-start justify-between gap-4">
                  <span className="moe-mini-icon">
                    <BriefcaseBusiness size={21} />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-violet-300/20 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">
                    <Target size={13} />
                    {skillCount} skills
                  </span>
                </div>
                <h2 className="mt-5 text-2xl font-black text-white">{track.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{track.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition group-hover:gap-3">
                  View track
                  <ArrowRight size={16} />
                </span>
              </Link>
            );
          }) : (
            <div className="moe-panel p-6 text-center md:col-span-2 xl:col-span-3">
              <span className="moe-mini-icon mx-auto">
                <BriefcaseBusiness size={22} />
              </span>
              <h2 className="mt-4 text-2xl font-black text-white">No career tracks published yet</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Active career tracks will appear here after they are created and published.
              </p>
              <Link className="moe-primary mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-black text-white" href="/courses">
                Browse courses
              </Link>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
