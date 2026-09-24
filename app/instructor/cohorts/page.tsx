import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Cohorts() {
  const user = await requireUser(['INSTRUCTOR']);
  const courses = await prisma.course.findMany({ where: { instructorId: user.id }, orderBy: { title: 'asc' } });
  const rows = await prisma.courseCohort.findMany({ where: { courseId: { in: courses.map((course) => course.id) } }, orderBy: { startsAt: 'asc' } });
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="instructor" title="Cohorts">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/instructor/cohorts" method="post">
        <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <input className="input" name="title" placeholder="Cohort title" required />
        <input className="input" name="startsAt" type="datetime-local" required />
        <input className="input" name="seats" type="number" min={0} placeholder="Seats" />
        <button className="btn-primary">Create Cohort</button>
      </form>
      <DataTable
        headers={['Title', 'Course', 'Starts', 'Seats']}
        rows={rows.map((cohort) => [
          cohort.title,
          courseTitles.get(cohort.courseId) || 'Archived course',
          cohort.startsAt.toLocaleString(),
          cohort.seats,
        ])}
      />
    </DashboardShell>
  );
}
