import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Milestones() {
  const user = await requireUser(['INSTRUCTOR']);
  const courses = await prisma.course.findMany({ where: { instructorId: user.id }, orderBy: { title: 'asc' } });
  const rows = await prisma.courseMilestone.findMany({ where: { courseId: { in: courses.map((course) => course.id) } }, orderBy: { sortOrder: 'asc' } });
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="instructor" title="Course Milestones">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/instructor/milestones" method="post">
        <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <input className="input" name="title" placeholder="Milestone title" required />
        <input className="input" name="sortOrder" type="number" defaultValue={0} />
        <button className="btn-primary">Add</button>
      </form>
      <DataTable
        headers={['Title', 'Course', 'Sort']}
        rows={rows.map((row) => [row.title, courseTitles.get(row.courseId) || 'Archived course', row.sortOrder])}
      />
    </DashboardShell>
  );
}
