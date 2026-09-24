export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowRight, Route, Layers3 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function PublicLearningPaths() {
  const paths = await prisma.learningPath.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <h1 className="text-5xl font-black text-white">Learning Paths</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Curated sequences that guide learners from first lesson to portfolio-ready skills.</p>
          </div>
          <span className="moe-control px-4 py-3 text-sm font-bold text-slate-200">
            {paths.length} paths
          </span>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {paths.length ? paths.map((path) => {
            const courseCount = fromJsonArray<string>(path.courseIds).length;
            return (
              <Link className="moe-panel moe-card-shine group p-5 transition hover:-translate-y-0.5" href={`/learning-paths/${path.slug}`} key={path.id}>
                <div className="flex items-start justify-between gap-4">
                  <span className="moe-mini-icon">
                    <Route size={21} />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-violet-300/20 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">
                    <Layers3 size={13} />
                    {courseCount} courses
                  </span>
                </div>
                <h2 className="mt-5 text-2xl font-black text-white">{path.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{path.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition group-hover:gap-3">
                  Open path
                  <ArrowRight size={16} />
                </span>
              </Link>
            );
          }) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No learning paths yet" description="Active learning paths will appear here once the admin publishes them." />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
