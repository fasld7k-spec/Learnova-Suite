import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function ModerationQueue() {
  await requireUser(['ADMIN']);
  const rows = await prisma.moderationQueueItem.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const courseIds = rows.filter((row) => row.entity.toLowerCase() === 'course').map((row) => row.entityId);
  const userIds = rows.filter((row) => row.entity.toLowerCase() === 'user').map((row) => row.entityId);
  const [courses, users] = await Promise.all([
    courseIds.length ? prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const userLabels = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));

  function itemLabel(entity: string, entityId: string) {
    const key = entity.toLowerCase();
    if (key === 'course') return courseTitles.get(entityId) || 'Archived course';
    if (key === 'user') return userLabels.get(entityId) || 'Deleted user';
    return entity;
  }

  return (
    <DashboardShell role="admin" title="Moderation Queue">
      <DataTable
        headers={['Item', 'Type', 'Reason', 'Status', 'Date', 'Actions']}
        rows={rows.map((item) => [
          itemLabel(item.entity, item.entityId),
          item.entity,
          item.reason,
          <Badge key="s" tone={item.status === 'PENDING' ? 'yellow' : item.status === 'APPROVED' ? 'green' : 'red'}>{item.status}</Badge>,
          item.createdAt.toLocaleString(),
          <div key="actions" className="flex min-w-56 flex-wrap gap-2">
            {['APPROVED', 'REJECTED', 'PENDING'].map((status) => (
              <form key={status} action="/api/admin/moderation-queue" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value={status} />
                <button className="btn-secondary text-xs">{status}</button>
              </form>
            ))}
            <form action="/api/admin/moderation-queue" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={item.id} />
              <button className="btn-secondary border-red-400/40 text-xs text-red-200">DELETE</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
