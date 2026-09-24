export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowRight, BookOpen, UserRoundCheck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';

export default async function Instructors() {
  const [instructors, settings] = await Promise.all([
    prisma.user.findMany({ where: { role: 'INSTRUCTOR', status: 'APPROVED' }, include: { courses: { where: { status: 'PUBLISHED' } } } }),
    getSiteSettings(),
  ]);
  const copy = localizedPageCopy(settings.defaultLanguage).catalog;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <h1 className="text-5xl font-black text-white">{copy.instructorsTitle}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">{copy.instructorsSubtitle}</p>
          </div>
          <span className="moe-control px-4 py-3 text-sm font-bold text-slate-200">
            {instructors.length} {copy.instructorsCount}
          </span>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {instructors.length ? instructors.map((instructor) => (
            <Link className="moe-panel moe-card-shine group p-5 transition hover:-translate-y-0.5" key={instructor.id} href={`/instructors/${instructor.id}`}>
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-lg border border-violet-300/25 bg-violet-500/15 text-violet-200">
                  <UserRoundCheck size={28} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-white">{instructor.name}</h2>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-slate-400">
                    <BookOpen size={14} />
                    {instructor.courses.length} {copy.instructorCourses}
                  </p>
                </div>
              </div>
              <p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-300">{instructor.bio || copy.instructorBioFallback}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition group-hover:gap-3">
                {copy.viewProfile}
                <ArrowRight size={16} />
              </span>
            </Link>
          )) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No public instructors yet" description="Approved instructors will appear here after publishing their profiles." />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
