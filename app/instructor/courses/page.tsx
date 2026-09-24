/* eslint-disable @next/next/no-img-element */
import { BookOpen, CheckCircle2, Clock3, ImageIcon, PlusCircle, Users } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

function statusTone(status: string) {
  if (status === 'PUBLISHED') return 'green';
  if (status === 'PENDING') return 'yellow';
  if (status === 'REJECTED') return 'red';
  return 'slate';
}

export default async function MyCourses() {
  const user = await requireUser(['INSTRUCTOR']);
  const [courses, settings] = await Promise.all([
    prisma.course.findMany({
      where: { instructorId: user.id },
      include: {
        category: true,
        enrollments: true,
        _count: { select: { modules: true, liveSessions: true, reviews: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    getSiteSettings()
  ]);
  const published = courses.filter((course) => course.status === 'PUBLISHED').length;
  const pending = courses.filter((course) => course.status === 'PENDING').length;
  const drafts = courses.filter((course) => course.status === 'DRAFT').length;
  const students = new Set(courses.flatMap((course) => course.enrollments.map((enrollment) => enrollment.userId))).size;
  const incomplete = courses.filter((course) => !course.coverImage || course._count.modules === 0).length;

  return (
    <DashboardShell role="instructor" title="My Courses">
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Courses" value={courses.length} icon={<BookOpen size={18} />} />
        <StatCard label="Published" value={published} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Pending review" value={pending} icon={<Clock3 size={18} />} />
        <StatCard label="Drafts" value={drafts} icon={<ImageIcon size={18} />} />
        <StatCard label="Students" value={students} icon={<Users size={18} />} />
      </div>

      <div className="mt-6 flex flex-col gap-4 border border-[#2F3336] bg-black p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-[#1D9BF0]">Instructor studio</p>
          <h2 className="mt-2 text-2xl font-black text-white">Course production pipeline</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
            Manage content readiness, enrollment traction, live class coverage and review status before submitting courses for approval.
          </p>
        </div>
        <a className="btn-primary w-fit" href="/instructor/courses/new">
          <PlusCircle size={16} />
          Create New Course
        </a>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">Course Catalog</h2>
          <Badge tone={incomplete ? 'yellow' : 'green'}>{incomplete} need content polish</Badge>
        </div>
        <DataTable
          headers={['Course', 'Category', 'Students', 'Signals', 'Price', 'Builder']}
          rows={courses.map((course) => [
            <div key="course" className="flex min-w-[280px] items-center gap-3">
              <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden border border-[#2F3336] bg-[#16181C]">
                {course.coverImage ? <img src={course.coverImage} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={20} className="text-[#1D9BF0]" />}
              </div>
              <div>
                <span className="font-bold text-white">{course.title}</span>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#71767B]">{course.shortDescription}</p>
              </div>
            </div>,
            course.category.nameEn,
            course.enrollments.length,
            <div key="signals" className="grid gap-1 text-xs font-semibold text-[#71767B]">
              <Badge tone={statusTone(course.status)}>{course.status}</Badge>
              <span>{course._count.modules} modules</span>
              <span>{course._count.liveSessions} live sessions</span>
              <span>{course._count.reviews} reviews</span>
            </div>,
            formatMoney(course.salePrice ?? course.price, settings.currency),
            <a key="builder" className="text-brand-600" href={`/instructor/courses/${course.id}`}>{course.status === 'DRAFT' || course.status === 'REJECTED' ? 'Continue setup' : 'Manage'}</a>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
