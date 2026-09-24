import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function BadgesAdmin() {
  await requireUser(['ADMIN']);
  const [badges, students] = await Promise.all([
    prisma.badgeAward.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' }, take: 500 }),
  ]);
  const missingUserIds = badges.map((badge) => badge.userId).filter((id) => !students.some((student) => student.id === id));
  const archivedUsers = missingUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: missingUserIds } }, select: { id: true, name: true, email: true } })
    : [];
  const users = [...students, ...archivedUsers];
  const userNames = new Map(users.map((user) => [user.id, user.name]));

  return (
    <DashboardShell role="admin" title="Badge Awards">
      <form className="card mb-6 grid gap-4" action="/api/admin/badges" method="post">
          <CsrfInput />
        <div>
          <h2 className="text-xl font-black text-white">Award Achievement</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Manually grant a student achievement. Automatic awards are also created when students complete lessons,
            pass quizzes, finish milestones, or complete a full course.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <select className="input" name="userId" required>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} - {student.email}
              </option>
            ))}
          </select>
          <input className="input" name="title" placeholder="Achievement title" required />
          <input className="input" name="icon" placeholder="Icon key e.g. trophy" />
          <input className="input" name="reason" placeholder="Reason shown to the student" required />
        </div>
        <button className="btn-primary w-fit">Grant Achievement</button>
      </form>

      <DataTable
        headers={['User', 'Title', 'Reason', 'Date', 'Manage']}
        rows={badges.map((badge) => [
          userNames.get(badge.userId) || 'User',
          badge.title,
          badge.reason,
          badge.createdAt.toLocaleDateString(),
          <div className="grid min-w-72 gap-3" key={badge.id}>
            <form className="grid gap-2" action="/api/admin/badges" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={badge.id} />
              <select className="input" name="userId" defaultValue={badge.userId}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </select>
              <input className="input" name="title" defaultValue={badge.title} />
              <input className="input" name="icon" defaultValue={badge.icon || ''} />
              <input className="input" name="reason" defaultValue={badge.reason} />
              <button className="btn-secondary h-10">Update</button>
            </form>
            <form action="/api/admin/badges" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={badge.id} />
              <button className="btn-secondary h-10 w-full border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
