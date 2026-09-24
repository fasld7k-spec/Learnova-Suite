import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function Collections() {
  const user = await requireUser(['STUDENT']);
  const [rows, enrollments] = await Promise.all([
    prisma.courseCollection.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.enrollment.findMany({ where: { userId: user.id }, include: { course: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  const courseTitles = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment.course.title]));

  return (
    <DashboardShell role="student" title="Course Collections">
      <form className="card mb-6 grid gap-3" action="/api/student/collections" method="post">
        <CsrfInput />
        <input className="input" name="title" placeholder="Collection title" required />
        <div className="grid gap-2">
          {enrollments.map((enrollment) => (
            <label className="flex items-center gap-2 rounded-full px-3 py-2 hover:bg-[#16181C]" key={enrollment.id}>
              <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="courseIds" value={enrollment.courseId} />
              <span className="text-sm font-semibold">{enrollment.course.title}</span>
            </label>
          ))}
        </div>
        <button className="btn-primary w-fit">Create Collection</button>
      </form>
      <DataTable
        headers={['Title', 'Courses', 'Created']}
        rows={rows.map((collection) => {
          const titles = fromJsonArray<string>(collection.courseIds)
            .map((courseId) => courseTitles.get(courseId))
            .filter(Boolean);
          return [collection.title, titles.length ? titles.join(', ') : 'No courses selected', collection.createdAt.toLocaleDateString()];
        })}
      />
    </DashboardShell>
  );
}
