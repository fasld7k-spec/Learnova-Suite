import Link from 'next/link';
import { Inbox, MessageCircleMore, Radio, UsersRound } from 'lucide-react';

import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { isActiveWithin } from '@/lib/communication';
import { CsrfInput } from '@/components/CsrfInput';

export const dynamic = 'force-dynamic';

export default async function AdminMessages({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const params = await searchParams;
  const conversations = await prisma.conversation.findMany({
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 3 } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  const unreadMessages = await prisma.message.count({ where: { read: false } });
  const totalMessages = await prisma.message.count();
  const participantIds = [...new Set(conversations.flatMap((conversation) => fromJsonArray<string>(conversation.userIds)))];
  const participants = participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { id: true, name: true, email: true, role: true }
      })
    : [];
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
  const now = new Date();
  const activeToday = conversations.filter((conversation) => {
    const lastMessage = conversation.messages[0];
    return isActiveWithin({ createdAt: lastMessage?.createdAt }, now, 24);
  }).length;

  return (
    <DashboardShell role="admin" title="Message Center">
      {params?.replied && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-black text-emerald-200">
          Admin reply sent and participants were notified.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Conversations" value={conversations.length} icon={<Inbox size={18} />} />
        <StatCard label="Messages" value={totalMessages} icon={<MessageCircleMore size={18} />} />
        <StatCard label="Unread queue" value={unreadMessages} icon={<Radio size={18} />} />
        <StatCard label="Participants" value={participants.length} icon={<UsersRound size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Admin message operations</p>
          <h2 className="mt-1 text-2xl font-black text-white">Monitor marketplace conversations</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
            Inspect learner, instructor, buyer and admin message activity from one desk. This gives reviewers a clear operational layer for support escalation and community follow-up.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn-primary" href="/messages">Open user inbox</Link>
            <Link className="btn-secondary" href="/admin/notifications">Notification operations</Link>
          </div>
        </div>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Routing readiness</p>
          <h3 className="mt-1 text-xl font-black text-white">Conversation health</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Active today</span>
              <Badge tone={activeToday ? 'green' : 'slate'}>{activeToday}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Unread workload</span>
              <Badge tone={unreadMessages ? 'yellow' : 'green'}>{unreadMessages}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Participant coverage</span>
              <Badge tone={participants.length ? 'green' : 'yellow'}>{participants.length}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Conversation', 'Participants', 'Last message', 'Recent volume', 'Status', 'Actions']}
          rows={conversations.map((conversation) => {
            const userIds = fromJsonArray<string>(conversation.userIds);
            const names = userIds.flatMap((id) => {
              const participant = participantMap.get(id);
              return participant ? [`${participant.name} (${participant.role.toLowerCase()})`] : [];
            });
            const lastMessage = conversation.messages[0];
            const unreadInThread = conversation.messages.filter((message) => !message.read).length;

            return [
              <div key="conversation">
                <p className="font-bold text-white">{conversation.subject}</p>
                <p className="mt-1 text-xs text-[#71767B]">Created {conversation.createdAt.toLocaleDateString()}</p>
              </div>,
              <p key="participants" className="max-w-sm text-sm leading-6">{names.join(', ') || 'Unknown participants'}</p>,
              lastMessage ? (
                <div key="last" className="max-w-xl">
                  <p className="line-clamp-2 text-sm text-[#E7E9EA]">{lastMessage.body}</p>
                  <p className="mt-1 text-xs text-[#71767B]">{lastMessage.createdAt.toLocaleString()}</p>
                </div>
              ) : '-',
              conversation.messages.length,
              <Badge key="status" tone={unreadInThread ? 'yellow' : 'green'}>{unreadInThread ? `${unreadInThread} unread recent` : 'Caught up'}</Badge>,
              <div key="actions" className="flex min-w-56 flex-wrap gap-2">
                <details className="w-full">
                  <summary className="btn-secondary inline-flex cursor-pointer text-xs">Reply as admin</summary>
                  <form action="/api/admin/messages" method="post" className="mt-2 space-y-2 rounded-2xl border border-[#2F3336] bg-[#050505] p-3">
          <CsrfInput />
                    <input type="hidden" name="_action" value="reply" />
                    <input type="hidden" name="conversationId" value={conversation.id} />
                    <textarea className="input min-h-24" name="body" placeholder="Write an operational reply to this conversation." required />
                    <button className="btn-primary w-full text-xs">Send reply</button>
                  </form>
                </details>
                {unreadInThread ? (
                  <form action="/api/admin/messages" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="mark-read" />
                    <input type="hidden" name="conversationId" value={conversation.id} />
                    <button className="btn-secondary text-xs">Mark read</button>
                  </form>
                ) : null}
                <form action="/api/admin/messages" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="conversationId" value={conversation.id} />
                  <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
                </form>
              </div>
            ];
          })}
        />
      </section>
    </DashboardShell>
  );
}
