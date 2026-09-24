import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function InstructorBadges() {
  await requireUser(['ADMIN']);
  const [instructors, badges] = await Promise.all([
    prisma.user.findMany({ where: { role: 'INSTRUCTOR' }, orderBy: { name: 'asc' } }),
    prisma.instructorBadge.findMany({ orderBy: { createdAt: 'desc' } })
  ]);
  const instructorNames = new Map(instructors.map((instructor) => [instructor.id, instructor.name]));

  return (
    <DashboardShell role="admin" title="Instructor Badges">
      <form className="card mb-6 grid gap-3" action="/api/admin/instructor-badges" method="post">
          <CsrfInput />
        <select className="input" name="instructorId" required>
          <option value="">Select instructor</option>
          {instructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
          ))}
        </select>
        <input className="input" name="title" placeholder="Badge title" required />
        <input className="input" name="icon" placeholder="Badge icon" />
        <input className="input" name="reason" placeholder="Reason" />
        <button className="btn-primary w-fit">Award Badge</button>
      </form>
      <DataTable
        headers={['Instructor', 'Title', 'Reason', 'Date', 'Manage']}
        rows={badges.map((badge) => [
          instructorNames.get(badge.instructorId) || 'Archived instructor',
          badge.title,
          badge.reason,
          badge.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/instructor-badges" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={badge.id} />
              <select className="input" name="instructorId" defaultValue={badge.instructorId}>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                ))}
              </select>
              <input className="input" name="title" defaultValue={badge.title} />
              <input className="input" name="icon" defaultValue={badge.icon || ''} />
              <input className="input" name="reason" defaultValue={badge.reason} />
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/instructor-badges" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={badge.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
