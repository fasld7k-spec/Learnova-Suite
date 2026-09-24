import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Waitlists(props: { searchParams?: Promise<{ invited?: string; deleted?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const rows = await prisma.courseWaitlist.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const courses = rows.length ? await prisma.course.findMany({ where: { id: { in: rows.map((row) => row.courseId) } } }) : [];
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const grouped = courses.map((course) => ({
    id: course.id,
    title: course.title,
    count: rows.filter((row) => row.courseId === course.id).length,
  })).filter((course) => course.count > 0);

  return (
    <DashboardShell role="admin" title="Course Waitlists">
      {searchParams?.invited && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">{searchParams.invited} waitlist invite(s) queued.</div>}
      {searchParams?.deleted && <div className="mb-4 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">{searchParams.deleted} waitlist record(s) removed.</div>}

      {grouped.length ? (
        <section className="card mb-6">
          <h2 className="text-xl font-black text-white">Bulk course actions</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Invite or clear everyone waiting for a specific course when enrollment opens.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {grouped.map((course) => (
              <div className="border border-[#2F3336] p-4" key={course.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{course.title}</p>
                    <p className="mt-1 text-sm text-[#71767B]">{course.count} waiting</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action="/api/admin/waitlists" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="invite_course" />
                      <input type="hidden" name="courseId" value={course.id} />
                      <button className="btn-primary text-xs">Invite all</button>
                    </form>
                    <form action="/api/admin/waitlists" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="delete_course" />
                      <input type="hidden" name="courseId" value={course.id} />
                      <button className="btn-secondary border-red-400/40 text-xs text-red-200">Clear course</button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <DataTable
        headers={['Course', 'Email', 'Date', 'Actions']}
        rows={rows.map((row) => [
          courseTitles.get(row.courseId) || 'Archived course',
          row.email,
          row.createdAt.toLocaleDateString(),
          <div key="actions" className="flex min-w-64 flex-wrap gap-2">
            <form action="/api/admin/waitlists" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="invite" />
              <input type="hidden" name="id" value={row.id} />
              <button className="btn-primary text-xs">Send invite</button>
            </form>
            <form action="/api/admin/waitlists" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={row.id} />
              <button className="btn-secondary border-red-400/40 text-xs text-red-200">Remove</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
