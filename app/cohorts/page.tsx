export const dynamic = 'force-dynamic';

import { CalendarDays, CheckCircle2, LogIn, UsersRound } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { EmptyState } from '@/components/EmptyState';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function PublicCohorts(props: { searchParams?: Promise<{ error?: string; joined?: string }> }) {
  const [rows, session, searchParams] = await Promise.all([
    prisma.courseCohort.findMany({ where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 50 }),
    getSession(),
    props.searchParams,
  ]);
  const cohortIds = rows.map((cohort) => cohort.id);
  const courseIds = rows.map((cohort) => cohort.courseId);
  const [courses, cohortEnrollments, myCohortEnrollments] = await Promise.all([
    courseIds.length ? prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, slug: true, title: true } }) : [],
    cohortIds.length ? prisma.cohortEnrollment.findMany({ where: { cohortId: { in: cohortIds } }, select: { cohortId: true } }) : [],
    session?.role === 'STUDENT' && cohortIds.length
      ? prisma.cohortEnrollment.findMany({ where: { userId: session.id, cohortId: { in: cohortIds } }, select: { cohortId: true } })
      : [],
  ]);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const joinedByCohort = new Set(myCohortEnrollments.map((row) => row.cohortId));
  const enrollmentCounts = new Map<string, number>();
  for (const row of cohortEnrollments) enrollmentCounts.set(row.cohortId, (enrollmentCounts.get(row.cohortId) || 0) + 1);

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">Upcoming Cohorts</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Scheduled group learning experiences with clear start dates and seat availability.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-4">
          {searchParams?.error && (
            <div className="border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
              {searchParams.error}
            </div>
          )}
          {searchParams?.joined && (
            <div className="border border-[#00BA7C]/40 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
              You joined the cohort successfully.
            </div>
          )}
          {rows.length ? rows.map((cohort) => (
            <div className="moe-panel moe-card-shine p-5" id={`cohort-${cohort.id}`} key={cohort.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-4">
                  <span className="moe-mini-icon h-12 w-12 shrink-0">
                    <CalendarDays size={22} />
                  </span>
                  <div>
                    <h2 className="text-xl font-black text-white">{cohort.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-400">Starts {cohort.startsAt.toLocaleString()}</p>
                    {courseById.get(cohort.courseId) && (
                      <a className="mt-2 inline-flex text-sm font-bold text-[#1D9BF0]" href={`/courses/${courseById.get(cohort.courseId)?.slug}`}>
                        {courseById.get(cohort.courseId)?.title}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-violet-300/20 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                    <UsersRound size={16} />
                    {Math.max((cohort.seats || 0) - (enrollmentCounts.get(cohort.id) || 0), 0)} seats left
                  </span>
                  {joinedByCohort.has(cohort.id) ? (
                    <span className="btn-secondary text-[#00BA7C]">
                      <CheckCircle2 size={16} />
                      Joined
                    </span>
                  ) : session?.role === 'STUDENT' ? (
                    <form action="/api/cohorts/enroll" method="post">
                      <CsrfInput />
                      <input type="hidden" name="cohortId" value={cohort.id} />
                      <button className="btn-primary" type="submit">Join cohort</button>
                    </form>
                  ) : (
                    <a className="btn-primary" href={`/login?redirect=/cohorts%23cohort-${cohort.id}`}>
                      <LogIn size={16} />
                      Sign in to join
                    </a>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <EmptyState title="No upcoming cohorts" description="New scheduled cohorts will appear here when instructors publish them." />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
