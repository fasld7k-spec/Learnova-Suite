import { BookOpen, Compass, GraduationCap, Sparkles } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CourseCard } from '@/components/CourseCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/dashboard/Badge';

export default async function StudentRecommendations() {
  const user = await requireUser(['STUDENT']);
  const [rules, enrollments] = await Promise.all([
    prisma.recommendationRule.findMany({ where: { active: true, OR: [{ audience: 'ALL' }, { audience: 'STUDENT' }] }, orderBy: { createdAt: 'desc' } }),
    prisma.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true, progress: true } })
  ]);
  const enrolledCourseIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
  const recommendedIds = [...new Set(rules.flatMap((rule) => fromJsonArray<string>(rule.courseIds)))].filter((courseId) => !enrolledCourseIds.has(courseId));
  const courses = await prisma.course.findMany({
    where: { id: { in: recommendedIds }, status: 'PUBLISHED' },
    include: { category: true, instructor: true },
    take: 12
  });
  const avgProgress = enrollments.length ? Math.round(enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / enrollments.length) : 0;

  return (
    <DashboardShell role="student" title="Recommended Courses">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Recommendations" value={courses.length} icon={<Sparkles size={18} />} />
        <StatCard label="Active rules" value={rules.length} icon={<Compass size={18} />} />
        <StatCard label="Current courses" value={enrollments.length} icon={<BookOpen size={18} />} />
        <StatCard label="Average progress" value={`${avgProgress}%`} icon={<GraduationCap size={18} />} />
      </div>

      <section className="mt-6 border border-[#2F3336] bg-black p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[#1D9BF0]">Personalized catalog</p>
            <h2 className="mt-2 text-2xl font-black text-white">Next courses to consider</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
              Recommendations exclude courses already enrolled by the learner and are driven by active admin recommendation rules.
            </p>
          </div>
          <Badge tone={courses.length ? 'green' : 'yellow'}>{courses.length ? 'Ready' : 'Needs admin rules'}</Badge>
        </div>
      </section>

      {courses.length ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      ) : (
        <div className="mt-6 border border-[#2F3336] bg-black p-8 text-center">
          <Sparkles className="mx-auto text-[#71767B]" size={38} />
          <h3 className="mt-4 text-xl font-black text-white">No new recommendations yet</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#71767B]">
            Add active recommendation rules from the admin workspace or publish more courses to populate this learner experience.
          </p>
          <a className="btn-secondary mt-5 w-fit" href="/courses">Browse marketplace</a>
        </div>
      )}
    </DashboardShell>
  );
}
