import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, Clock3 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { EmptyState } from '@/components/EmptyState';

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
}

export default async function StudentMyCourses({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(['STUDENT']);
  const params = await searchParams;
  const page = Math.max(1, Number(Array.isArray(params?.page) ? params?.page[0] : params?.page || 1) || 1);
  const pageSize = 24;
  const [statsEnrollments, enrollments, totalEnrollments] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId: user.id }, select: { progress: true, completedAt: true } }),
    prisma.enrollment.findMany({
      where: { userId: user.id },
      include: { course: { include: { category: true, modules: { include: { lessons: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.enrollment.count({ where: { userId: user.id } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalEnrollments / pageSize));
  const averageProgress = statsEnrollments.length ? Math.round(statsEnrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / statsEnrollments.length) : 0;

  return (
    <DashboardShell role="student" title="My Courses">
      {enrollments.length ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="border border-[#2F3336] bg-black p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#71767B]">Active</p>
              <b className="mt-2 block text-2xl font-black text-white">{statsEnrollments.length}</b>
            </div>
            <div className="border border-[#2F3336] bg-black p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#71767B]">Completed</p>
              <b className="mt-2 block text-2xl font-black text-white">{statsEnrollments.filter((enrollment) => enrollment.completedAt).length}</b>
            </div>
            <div className="border border-[#2F3336] bg-black p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#71767B]">Average progress</p>
              <b className="mt-2 block text-2xl font-black text-white">
                {averageProgress}%
              </b>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {enrollments.map((enrollment) => {
              const lessonCount = enrollment.course.modules.reduce((sum, module) => sum + module.lessons.length, 0);

              return (
                <Link className="group border border-[#2F3336] bg-black p-4 transition hover:bg-[#16181C] sm:p-5" key={enrollment.id} href={`/learn/${enrollment.course.slug}`}>
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1D9BF0]">{enrollment.course.category?.nameEn || 'Course'}</p>
                      <h2 className="mt-2 line-clamp-2 text-xl font-black text-white">{enrollment.course.title}</h2>
                      <p className="mt-2 text-sm text-[#71767B]">Joined {formatDate(enrollment.createdAt)}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#2F3336] px-3 py-2 text-sm font-bold text-white">
                      Resume
                      <ArrowRight size={15} strokeWidth={1.8} />
                    </span>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-bold text-[#71767B]">
                      <span>{enrollment.progress}% complete</span>
                      <span>{lessonCount} lessons</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#16181C]">
                      <div className="h-full rounded-full bg-[#1D9BF0]" style={{ width: `${Math.min(100, Math.max(0, enrollment.progress))}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#71767B]">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2F3336] px-3 py-1.5">
                      <BookOpen size={14} strokeWidth={1.8} />
                      {enrollment.course.modules.length} modules
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2F3336] px-3 py-1.5">
                      <Clock3 size={14} strokeWidth={1.8} />
                      {Math.max(1, Math.round(enrollment.course.durationMinutes / 60))}h
                    </span>
                    {enrollment.completedAt && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2F3336] px-3 py-1.5 text-[#1D9BF0]">
                        <CheckCircle2 size={14} strokeWidth={1.8} />
                        Completed
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          {totalPages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-[#2F3336] bg-black p-4 text-sm font-bold text-[#E7E9EA]">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Link className={`btn-secondary ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`} href={`/student/my-courses?page=${page - 1}`}>Previous</Link>
                <Link className={`btn-secondary ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`} href={`/student/my-courses?page=${page + 1}`}>Next</Link>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No enrolled courses yet"
          description="Browse the catalog and enroll in a course to start learning from this workspace."
          action={<Link className="btn-primary" href="/courses">Browse courses</Link>}
        />
      )}
    </DashboardShell>
  );
}
