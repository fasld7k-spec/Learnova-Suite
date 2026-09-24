import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function CourseViews() {
  await requireUser(['ADMIN']);
  const views = await prisma.courseView.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const [courses, users] = await Promise.all([
    views.length ? prisma.course.findMany({ where: { id: { in: views.map((view) => view.courseId) } } }) : [],
    views.length ? prisma.user.findMany({ where: { id: { in: views.map((view) => view.userId).filter(Boolean) as string[] } } }) : [],
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const userNames = new Map(users.map((user) => [user.id, user.name]));

  return (
    <DashboardShell role="admin" title="Course Views">
      {views.length ? (
        <form className="mb-4 flex flex-wrap items-end gap-3" action="/api/admin/course-views" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge-old" />
          <label className="text-sm font-bold text-[#E7E9EA]">
            Delete records older than days
            <input className="input mt-2 w-36" name="days" type="number" min="1" defaultValue="90" />
          </label>
          <button className="btn-secondary border-red-400/40 text-red-200">Purge old views</button>
        </form>
      ) : null}
      <DataTable
        headers={['Course', 'User', 'IP', 'Date', 'Action']}
        rows={views.map((view) => [
          courseTitles.get(view.courseId) || 'Archived course',
          view.userId ? userNames.get(view.userId) || 'User' : 'Guest',
          view.ip || '-',
          view.createdAt.toLocaleString(),
          <form key="action" action="/api/admin/course-views" method="post">
          <CsrfInput />
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={view.id} />
            <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
