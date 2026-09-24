import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Prerequisites() {
  await requireUser(['ADMIN']);
  const [courses, rows] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: 'asc' } }),
    prisma.coursePrerequisite.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Course Prerequisites">
      <form className="card mb-6 grid gap-3 md:grid-cols-3" action="/api/admin/prerequisites" method="post">
          <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <select className="input" name="prerequisiteCourseId" required>
          <option value="">Prerequisite</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <button className="btn-primary">Add Prerequisite</button>
      </form>
      <DataTable
        headers={['Course', 'Prerequisite', 'Date', 'Manage']}
        rows={rows.map((row) => [
          courseTitles.get(row.courseId) || 'Archived course',
          courseTitles.get(row.prerequisiteCourseId) || 'Archived course',
          row.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/prerequisites" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={row.id} />
              <select className="input" name="courseId" defaultValue={row.courseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <select className="input" name="prerequisiteCourseId" defaultValue={row.prerequisiteCourseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/prerequisites" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={row.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
