import Link from 'next/link';
import { ArrowRight, BookOpen, CalendarDays, Clock3, Radio, UserRoundCheck } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { CourseCard } from '@/components/CourseCard';
import { EmptyState } from '@/components/EmptyState';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';
import { notFound } from 'next/navigation';

export default async function InstructorProfile(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [instructor, settings] = await Promise.all([
    prisma.user.findFirst({
      where: { id: params.id, role: 'INSTRUCTOR', status: 'APPROVED' },
      include: { courses: { where: { status: 'PUBLISHED' }, include: { category: true, instructor: true } } }
    }),
    getSiteSettings(),
  ]);
  if (!instructor) notFound();
  const copy = localizedPageCopy(settings.defaultLanguage).catalog;
  const [availability, upcomingLiveSessions] = await Promise.all([
    prisma.instructorAvailability.findMany({
      where: { instructorId: instructor.id, active: true },
      orderBy: [{ weekday: 'asc' }, { startsAt: 'asc' }],
    }),
    prisma.liveSession.count({ where: { instructorId: instructor.id, startsAt: { gte: new Date() } } }),
  ]);

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid gap-6 p-6 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-violet-300/25 bg-violet-500/15 text-violet-200">
              <UserRoundCheck size={34} />
            </div>
            <div>
              <h1 className="text-5xl font-black text-white">{instructor.name}</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{instructor.bio || copy.instructorBioFallback}</p>
            </div>
          </div>
          <div className="moe-panel h-fit p-5">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
              <BookOpen size={16} />
              {copy.publishedCoursesLabel}
            </p>
            <b className="mt-2 block text-4xl font-black">{instructor.courses.length}</b>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-400">
              <Radio size={16} />
              {upcomingLiveSessions} {copy.upcomingLiveSessions}
            </p>
            <Link className="moe-primary mt-5 w-full justify-center px-5 py-3" href={`/instructors/${instructor.id}/book`}>
              {copy.bookInstructor}
              <CalendarDays size={17} />
            </Link>
          </div>
        </div>
        </section>

        <section className="page-shell mt-8">
        <div className="moe-panel p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                <Clock3 size={16} />
                {copy.weeklyAvailability}
              </p>
              <h2 className="mt-2 text-3xl font-black">{copy.bookLiveWith} {instructor.name}</h2>
            </div>
            <Link className="moe-primary px-5 py-3" href={`/instructors/${instructor.id}/book`}>
              {copy.requestSlot}
              <ArrowRight size={17} />
            </Link>
          </div>
          {availability.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {availability.map((slot) => (
                <div className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-4" key={slot.id}>
                  <b className="text-lg text-white">{copy.weekdays[slot.weekday] || copy.weekly}</b>
                  <p className="mt-2 text-sm font-bold text-violet-200">{slot.startsAt} - {slot.endsAt}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{slot.timezone}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-slate-400">
              {copy.noAvailability}
            </p>
          )}
        </div>
        </section>

        <section className="page-shell mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl font-black">{copy.coursesBy} {instructor.name}</h2>
          <ArrowRight size={22} className="hidden text-slate-400 sm:block" />
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {instructor.courses.length ? instructor.courses.map((course) => (
            <CourseCard key={course.id} course={course} locale={settings.defaultLanguage} />
          )) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title={copy.noPublishedCourses} description={copy.noPublishedCoursesBody} />
            </div>
          )}
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
