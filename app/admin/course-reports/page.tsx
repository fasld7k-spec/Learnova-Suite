import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function CourseReports(props: { searchParams?: Promise<{ saved?: string; deleted?: string; queued?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const reports = await prisma.courseReport.findMany({ orderBy: { createdAt: 'desc' } });
  const [users, courses] = await Promise.all([
    reports.length ? prisma.user.findMany({ where: { id: { in: reports.map((report) => report.userId) } } }) : [],
    reports.length ? prisma.course.findMany({ where: { id: { in: reports.map((report) => report.courseId) } } }) : [],
  ]);
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Course Reports">
      {searchParams?.saved && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Course report updated.</div>}
      {searchParams?.deleted && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Course report deleted.</div>}
      {searchParams?.queued && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Course sent to moderation queue.</div>}
      <DataTable
        headers={['User', 'Course', 'Reason', 'Status', 'Date', 'Action']}
        rows={reports.map((report) => [
          userNames.get(report.userId) || 'User',
          courseTitles.get(report.courseId) || 'Archived course',
          report.reason,
          <Badge key="s" tone={report.status === 'OPEN' ? 'yellow' : 'green'}>{report.status}</Badge>,
          report.createdAt.toLocaleDateString(),
          <div key="action" className="grid min-w-80 gap-2">
            <form action="/api/admin/course-reports" method="post" className="flex flex-wrap gap-2">
          <CsrfInput />
              <input type="hidden" name="id" value={report.id} />
              <select className="input min-w-32" name="status" defaultValue={report.status}>
                <option value="OPEN">OPEN</option>
                <option value="REVIEWING">REVIEWING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="DISMISSED">DISMISSED</option>
              </select>
              <button className="btn-primary">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/course-reports" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="queue" />
                <input type="hidden" name="id" value={report.id} />
                <button className="btn-secondary text-xs">Send to moderation</button>
              </form>
              <form action="/api/admin/course-reports" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={report.id} />
                <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
