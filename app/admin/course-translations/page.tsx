import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function CourseTranslations() {
  await requireUser(['ADMIN']);
  const [courses, rows] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: 'asc' } }),
    prisma.courseTranslation.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Course Translations">
      <form className="card mb-6 grid gap-3" action="/api/admin/course-translations" method="post">
          <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <input className="input" name="locale" placeholder="ar / en" required />
        <input className="input" name="title" placeholder="Translated title" required />
        <textarea className="input min-h-24" name="shortDescription" placeholder="Short description" />
        <textarea className="input min-h-32" name="fullDescription" placeholder="Full description" />
        <button className="btn-primary w-fit">Save Translation</button>
      </form>
      <DataTable
        headers={['Course', 'Locale', 'Title', 'Created', 'Manage']}
        rows={rows.map((row) => [
          courseTitles.get(row.courseId) || 'Archived course',
          row.locale,
          row.title,
          row.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-96 gap-2">
            <form className="grid gap-2" action="/api/admin/course-translations" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={row.id} />
              <select className="input" name="courseId" defaultValue={row.courseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <input className="input" name="locale" defaultValue={row.locale} />
              <input className="input" name="title" defaultValue={row.title} />
              <textarea className="input min-h-24" name="shortDescription" defaultValue={row.shortDescription} />
              <textarea className="input min-h-32" name="fullDescription" defaultValue={row.fullDescription} />
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/course-translations" method="post">
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
