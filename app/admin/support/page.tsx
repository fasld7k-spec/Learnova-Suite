import Link from 'next/link';
import { Headphones, MessageSquareReply, MessageSquareText, TimerReset } from 'lucide-react';

import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { supportTicketAgeHours } from '@/lib/communication';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Support({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const params = await searchParams;
  const replied = typeof params?.replied === 'string' ? params.replied : '';
  const [tickets, replies, conversations, tags, slaPolicies] = await Promise.all([
    prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.supportReply.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.conversation.count(),
    prisma.supportTag.findMany({ orderBy: { name: 'asc' } }),
    prisma.slaPolicy.findMany({ where: { active: true }, orderBy: { responseHrs: 'asc' }, take: 1 }),
  ]);
  const now = new Date();
  const responseSlaHrs = slaPolicies[0]?.responseHrs || 24;

  const open = tickets.filter((ticket) => ticket.status === 'OPEN').length;
  const answered = tickets.filter((ticket) => ticket.status === 'ANSWERED').length;
  const stale = tickets.filter((ticket) => ticket.status === 'OPEN' && supportTicketAgeHours(ticket.createdAt, now) >= responseSlaHrs).length;
  const repliesByTicket = new Map<string, number>();
  const replyRowsByTicket = new Map<string, typeof replies>();
  replies.forEach((reply) => {
    repliesByTicket.set(reply.ticketId, (repliesByTicket.get(reply.ticketId) ?? 0) + 1);
    replyRowsByTicket.set(reply.ticketId, [...(replyRowsByTicket.get(reply.ticketId) ?? []), reply]);
  });

  return (
    <DashboardShell role="admin" title="Support Tickets">
      {replied ? (
        <div className={`mb-6 border p-4 text-sm font-bold text-white ${replied === 'sent' ? 'border-[#00BA7C] bg-[#001F15]' : replied === 'failed' ? 'border-[#F4212E] bg-[#2A070A]' : 'border-[#FFD400] bg-[#241A00]'}`}>
          {replied === 'sent'
            ? 'Reply saved and email delivered through the configured provider.'
            : replied === 'failed'
              ? 'Reply saved, but email delivery failed. Review Email Logs and SMTP settings.'
              : 'Reply saved and queued in the email log. Configure SMTP in Settings to deliver real email.'}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tickets" value={tickets.length} icon={<Headphones size={18} />} />
        <StatCard label="Open" value={open} icon={<TimerReset size={18} />} />
        <StatCard label="Answered" value={answered} icon={<MessageSquareReply size={18} />} />
        <StatCard label="Message threads" value={conversations} icon={<MessageSquareText size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Support command center</p>
          <h2 className="mt-1 text-2xl font-black text-white">Resolve buyer and learner requests</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
            Support tickets, replies, SLA risk and live message threads are grouped here so reviewers see a complete customer operations workflow.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn-primary" href="/admin/messages">Message center</Link>
            <Link className="btn-secondary" href="/admin/sla">SLA policies</Link>
            <Link className="btn-secondary" href="/admin/support-tags">Support tags</Link>
          </div>
        </div>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Queue readiness</p>
          <h3 className="mt-1 text-xl font-black text-white">Support health</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Open queue</span>
              <Badge tone={open ? 'yellow' : 'green'}>{open}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Stale over {responseSlaHrs}h</span>
              <Badge tone={stale ? 'red' : 'green'}>{stale}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Reply coverage</span>
              <Badge tone={replies.length ? 'green' : 'slate'}>{replies.length}</Badge>
            </div>
          </div>
        </aside>
      </section>

      {tickets.length === 0 ? (
        <section className="mt-6 border border-[#2F3336] bg-black p-6">
          <p className="text-lg font-black text-white">No support tickets yet.</p>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            New contact form requests and buyer support tickets will appear here for admin follow-up.
          </p>
        </section>
      ) : (
        <div className="mt-6 grid gap-4">
          {tickets.map((ticket) => {
            const hours = supportTicketAgeHours(ticket.createdAt, now);
            const replyCount = repliesByTicket.get(ticket.id) ?? 0;
            const matchedTags = tags.filter((tag) => {
              const haystack = `${ticket.subject} ${ticket.message}`.toLowerCase();
              return haystack.includes(`tag:${tag.name}`) || haystack.includes(tag.name.toLowerCase());
            });
            return (
              <article className="border border-[#2F3336] bg-black p-5" key={ticket.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black text-white">{ticket.subject}</h2>
                      <Badge tone={ticket.status === 'OPEN' ? 'yellow' : ticket.status === 'ANSWERED' ? 'green' : ticket.status === 'CLOSED' ? 'slate' : 'red'}>{ticket.status}</Badge>
                      <Badge tone={hours >= responseSlaHrs && ticket.status === 'OPEN' ? 'red' : 'slate'}>{hours}h old</Badge>
                      {matchedTags.map((tag) => (
                        <span key={tag.id} className="rounded-full border px-3 py-1 text-xs font-black" style={{ borderColor: tag.color, color: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-[#71767B]">
                      {ticket.name} &middot; {ticket.email} &middot; {replyCount} replies
                    </p>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#E7E9EA]">{ticket.message}</p>

                {(replyRowsByTicket.get(ticket.id) ?? []).length ? (
                  <details className="mt-4 border border-[#2F3336] p-4">
                    <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">View reply history ({replyCount})</summary>
                    <div className="mt-4 grid gap-3">
                      {(replyRowsByTicket.get(ticket.id) ?? []).map((reply) => (
                        <div key={reply.id} className="border-b border-[#2F3336] pb-3 last:border-b-0 last:pb-0">
                          <p className="whitespace-pre-line text-sm leading-6 text-[#E7E9EA]">{reply.body}</p>
                          <p className="mt-2 text-xs font-semibold text-[#71767B]">{reply.createdAt.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                <form className="mt-5 grid gap-3" action="/api/admin/support/reply" method="post">
          <CsrfInput />
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <textarea className="input min-h-28" name="body" placeholder="Reply to customer with a clear next step" required />
                  <button className="btn-primary w-fit">Send Reply</button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.length ? (
                    <form className="flex flex-wrap gap-2" action="/api/admin/support" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="tag" />
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <select className="input h-10 min-w-40" name="tag" defaultValue={matchedTags[0]?.name || tags[0].name}>
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.name}>{tag.name}</option>
                        ))}
                      </select>
                      <button className="btn-secondary">Apply tag</button>
                    </form>
                  ) : null}
                  <form action="/api/admin/support" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="status" />
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <input type="hidden" name="status" value={ticket.status === 'CLOSED' ? 'OPEN' : 'CLOSED'} />
                    <button className="btn-secondary">{ticket.status === 'CLOSED' ? 'Reopen ticket' : 'Close ticket'}</button>
                  </form>
                  <form action="/api/admin/support" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <button className="btn-secondary border-red-400/40 text-red-200">Delete ticket</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
