import { Inbox, MessageSquareText, SearchCheck, Send, UsersRound } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { ConversationInbox } from '@/components/messages/ConversationInbox';
import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { Badge } from '@/components/dashboard/Badge';
import { fromJsonArray, listHas } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { StatCard } from '@/components/dashboard/StatCard';
import { isActiveWithin } from '@/lib/communication';

export const dynamic = 'force-dynamic';

export default async function Messages() {
  const user = await requireUser();
  const conversations = await prisma.conversation.findMany({
    where: { userIds: listHas(user.id) },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' }
  });
  const unread = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      senderId: { not: user.id },
      read: false,
      conversation: { userIds: listHas(user.id) }
    },
    _count: { _all: true }
  });
  const unreadByConversation = new Map(unread.map((row) => [row.conversationId, row._count._all]));
  const participantIds = [...new Set(conversations.flatMap((conversation) => fromJsonArray<string>(conversation.userIds)))];
  const participantUsers = participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { id: true, name: true, email: true, role: true }
      })
    : [];
  const participantMap = new Map(participantUsers.map((participant) => [participant.id, participant]));
  const recipients = await prisma.user.findMany({
    where: { id: { not: user.id }, status: 'APPROVED' },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    take: 100
  });
  const unreadTotal = unread.reduce((sum, row) => sum + row._count._all, 0);
  const now = new Date();
  const activeToday = conversations.filter((conversation) => {
    const lastMessage = conversation.messages[0];
    return isActiveWithin({ createdAt: lastMessage?.createdAt }, now, 24);
  }).length;
  const recipientRoles = new Set(recipients.map((recipient) => recipient.role)).size;

  return (
    <>
      <Nav />
      <main className="moe-page py-10">
        <section className="page-shell border-b border-violet-300/15 pb-8">
          <p className="text-sm font-black uppercase text-violet-300">Advanced message hub</p>
          <h1 className="mt-2 text-4xl font-black text-white">Messages</h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Route buyer, instructor, learner and admin conversations from one Live priority inbox with unread tracking and recipient context.
          </p>
        </section>

        <div className="page-shell mt-8 grid gap-4 md:grid-cols-4">
          <StatCard label="Conversations" value={conversations.length} icon={<Inbox size={18} />} />
          <StatCard label="Unread messages" value={unreadTotal} icon={<MessageSquareText size={18} />} />
          <StatCard label="Active today" value={activeToday} icon={<SearchCheck size={18} />} />
          <StatCard label="Recipient roles" value={recipientRoles} icon={<UsersRound size={18} />} />
        </div>

        <section className="page-shell mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
          <form className="moe-panel rounded-xl p-6" action="/api/messages" method="post">
            <CsrfInput />
            <div className="mb-5">
              <p className="text-xs font-bold uppercase text-slate-400">Recipient routing</p>
              <h2 className="mt-1 text-2xl font-black text-white">Start a focused thread</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Use clear subjects and structured messages so support, coaching and sales conversations stay searchable.
              </p>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-200">Recipient</span>
                <select className="moe-control h-12 w-full px-4 text-sm font-semibold" name="recipientId" required>
                  <option value="">Choose a student, instructor, or admin</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.name} - {recipient.role.toLowerCase()} - {recipient.email}
                    </option>
                  ))}
                </select>
              </label>
              <input className="moe-control h-12 w-full px-4 text-sm font-semibold" name="subject" placeholder="Subject" required />
              <textarea className="moe-control min-h-28 w-full px-4 py-3 text-sm font-semibold" name="body" placeholder="Message" required />
            </div>
            <button className="moe-primary mt-4 inline-flex h-11 w-fit items-center gap-2 rounded-lg px-5 text-sm font-black">
              <Send size={17} />
              Send Message
            </button>
          </form>

          <aside className="moe-panel rounded-xl p-5">
            <p className="text-xs font-bold uppercase text-slate-400">Conversation health</p>
            <h3 className="mt-1 text-xl font-black text-white">Inbox readiness</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span>Unread queue</span>
                <Badge tone={unreadTotal ? 'yellow' : 'green'}>{unreadTotal}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Live conversations</span>
                <Badge tone={activeToday ? 'green' : 'slate'}>{activeToday}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Approved recipients</span>
                <Badge tone={recipients.length ? 'green' : 'yellow'}>{recipients.length}</Badge>
              </div>
            </div>
          </aside>
        </section>
        <div className="page-shell mt-4 flex flex-wrap gap-2">
          <Badge tone="blue">{conversations.length} conversations</Badge>
          <Badge tone={unread.length ? 'yellow' : 'green'}>{unreadTotal} unread</Badge>
        </div>
        <div className="page-shell">
        <ConversationInbox
          initialConversations={conversations.map((conversation) => ({
            id: conversation.id,
            subject: conversation.subject,
            createdAt: conversation.createdAt.toISOString(),
            unreadCount: unreadByConversation.get(conversation.id) || 0,
            participants: fromJsonArray<string>(conversation.userIds)
              .filter((id) => id !== user.id)
              .flatMap((id) => {
                const participant = participantMap.get(id);
                return participant
                  ? [{
                      id: participant.id,
                      name: participant.name,
                      email: participant.email,
                      role: participant.role
                    }]
                  : [];
              }),
            lastMessage: conversation.messages[0]
              ? {
                  body: conversation.messages[0].body,
                  createdAt: conversation.messages[0].createdAt.toISOString()
                }
              : null
          }))}
        />
        </div>
      </main>
      <Footer />
    </>
  );
}
