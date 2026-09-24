import Link from 'next/link';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function AdminDiscussions() {
  await requireUser(['ADMIN']);

  const topics = await prisma.discussionTopic.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    include: { _count: { select: { replies: true } } },
    take: 100,
  });

  return (
    <DashboardShell role="admin" title="Discussions">
      <DataTable
        headers={['Title', 'Replies', 'Pinned', 'Locked', 'Date', 'Manage']}
        rows={topics.map((topic) => [
          <div key="title" className="min-w-64">
            <Link className="font-black text-white hover:text-[#1D9BF0]" href={`/community/${topic.id}`}>
              {topic.title}
            </Link>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#71767B]">{topic.body}</p>
          </div>,
          topic._count.replies,
          <Badge key="p" tone={topic.pinned ? 'green' : 'slate'}>{topic.pinned ? 'Pinned' : 'No'}</Badge>,
          <Badge key="l" tone={topic.locked ? 'red' : 'green'}>{topic.locked ? 'Locked' : 'Open'}</Badge>,
          topic.createdAt.toLocaleDateString(),
          <div key="manage" className="flex min-w-72 flex-wrap gap-2">
            <form action="/api/admin/discussions" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={topic.id} />
              <input type="hidden" name="action" value="pin" />
              <button className="btn-secondary">{topic.pinned ? 'Unpin' : 'Pin'}</button>
            </form>
            <form action="/api/admin/discussions" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={topic.id} />
              <input type="hidden" name="action" value="lock" />
              <button className="btn-secondary">{topic.locked ? 'Unlock' : 'Lock'}</button>
            </form>
            <form action="/api/admin/discussions" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={topic.id} />
              <input type="hidden" name="action" value="delete" />
              <button className="btn-secondary">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
