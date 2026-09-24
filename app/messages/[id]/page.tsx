import { notFound } from 'next/navigation';
import { MessageCircle, ShieldCheck, UsersRound } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { RealtimeChat } from '@/components/messages/RealtimeChat';
import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { getCsrfToken } from '@/lib/csrf';
import { fromJsonArray, listHas } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';

export const dynamic = 'force-dynamic';

export default async function ConversationPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [user, csrfToken] = await Promise.all([requireUser(), getCsrfToken()]);
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, userIds: listHas(user.id) },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });
  if (!conversation) notFound();
  const participantIds = fromJsonArray<string>(conversation.userIds);
  const participants = participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { id: true, name: true, email: true, role: true }
      })
    : [];
  const unreadBeforeOpen = conversation.messages.filter((message) => message.senderId !== user.id && !message.read).length;
  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: user.id }, read: false },
    data: { read: true }
  });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="mx-auto max-w-5xl px-4">
          <div className="moe-panel-soft p-6 md:p-8">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-200">Advanced conversation workspace</p>
            <h1 className="mt-2 text-3xl font-black text-white">{conversation.subject}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {participants.map((participant) => (
                <Badge key={participant.id} tone={participant.id === user.id ? 'blue' : 'slate'}>
                  {participant.name} - {participant.role.toLowerCase()}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StatCard label="Thread messages" value={conversation.messages.length} icon={<MessageCircle size={18} />} />
            <StatCard label="Participants" value={participants.length} icon={<UsersRound size={18} />} />
            <StatCard label="Unread on open" value={unreadBeforeOpen} icon={<ShieldCheck size={18} />} />
          </div>

          <div className="mt-6">
            <RealtimeChat
              conversationId={conversation.id}
              currentUserId={user.id}
              csrfToken={csrfToken}
              initialMessages={conversation.messages.map((message) => ({
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                body: message.body,
                read: message.read,
                createdAt: message.createdAt.toISOString()
              }))}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
