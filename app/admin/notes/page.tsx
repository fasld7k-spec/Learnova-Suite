import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function AdminNotes(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const notes = await prisma.adminNote.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const userIds = notes.filter((note) => note.entity.toLowerCase() === 'user').map((note) => note.entityId);
  const courseIds = notes.filter((note) => note.entity.toLowerCase() === 'course').map((note) => note.entityId);
  const orderIds = notes.filter((note) => note.entity.toLowerCase() === 'order').map((note) => note.entityId);
  const [users, courses, orders] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    courseIds.length ? prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    orderIds.length ? prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, invoiceNumber: true } }) : Promise.resolve([]),
  ]);
  const usersById = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));
  const coursesById = new Map(courses.map((course) => [course.id, course.title]));
  const ordersById = new Map(orders.map((order) => [order.id, order.invoiceNumber]));

  function entityLabel(entity: string, entityId: string) {
    const key = entity.toLowerCase();
    if (key === 'user') return usersById.get(entityId) || 'Deleted user';
    if (key === 'course') return coursesById.get(entityId) || 'Archived course';
    if (key === 'order') return ordersById.get(entityId) || 'Order';
    return entity;
  }

  return (
    <DashboardShell role="admin" title="Admin Notes">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/admin/notes" method="post">
          <CsrfInput />
        <select className="input" name="entity" defaultValue="user">
          <option value="user">User</option>
          <option value="course">Course</option>
          <option value="order">Order</option>
          <option value="system">System</option>
        </select>
        <input className="input" name="entityId" placeholder="Email, slug, invoice, or ID" />
        <input className="input" name="note" placeholder="Note" />
        <button className="btn-primary">Add Note</button>
      </form>
      <DataTable
        headers={['Related item', 'Type', 'Note', 'Date']}
        rows={notes.map((note) => [
          entityLabel(note.entity, note.entityId),
          note.entity,
          note.note,
          note.createdAt.toLocaleString(),
        ])}
      />
    </DashboardShell>
  );
}
