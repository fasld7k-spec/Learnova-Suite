'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Filter, MessageCircle, Search, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { isActiveWithin } from '@/lib/communication';

type ConversationItem = {
  id: string;
  subject: string;
  createdAt: string | Date;
  unreadCount: number;
  participants?: Array<{ id: string; name: string; email: string; role: string }>;
  lastMessage: { body: string; createdAt: string | Date } | null;
};

type FilterMode = 'all' | 'unread' | 'active';

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function ConversationInbox({ initialConversations }: { initialConversations: ConversationItem[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch('/api/messages', { headers: { accept: 'application/json' } });
        const payload = await response.json();
        if (!cancelled && response.ok && payload.success) {
          setConversations(payload.data.conversations);
          setLive(true);
        }
      } catch {
        if (!cancelled) setLive(false);
      }
    }

    void refresh();
    const timer = setInterval(refresh, 5_000);
    const clock = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(clock);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = conversations.filter((conversation) => {
    const active = isActiveWithin({ createdAt: conversation.lastMessage?.createdAt }, new Date(now), 24);
    const haystack = [
      conversation.subject,
      conversation.lastMessage?.body,
      ...(conversation.participants || []).flatMap((participant) => [participant.name, participant.email, participant.role])
    ].filter(Boolean).join(' ').toLowerCase();

    if (filter === 'unread' && conversation.unreadCount === 0) return false;
    if (filter === 'active' && !active) return false;
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });
  const unreadTotal = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  return (
    <section className="moe-panel mt-8 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-300/15 p-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-violet-200" />
          <h2 className="text-lg font-black text-white">Auto-refresh priority inbox</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={unreadTotal ? 'yellow' : 'green'}>{unreadTotal} unread</Badge>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            {live ? <Wifi size={15} className="text-emerald-300" /> : <WifiOff size={15} className="text-amber-300" />}
            {live ? 'Auto-refreshing every few seconds' : 'Waiting for in-app updates'}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-violet-300/15 p-4 lg:grid-cols-[1fr_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            className="moe-control w-full pl-10"
            placeholder="Search subject, participant, role, or message"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          {(['all', 'unread', 'active'] as const).map((mode) => (
            <button
              className={`rounded-md border px-3 py-2 text-xs font-black uppercase transition ${filter === mode ? 'border-violet-300/50 bg-violet-400/15 text-violet-100' : 'border-violet-300/15 text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}
              key={mode}
              onClick={() => setFilter(mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid">
        {filtered.map((conversation) => (
          <Link className="border-b border-violet-300/15 p-5 transition hover:bg-white/[0.04]" key={conversation.id} href={`/messages/${conversation.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xl font-bold text-white">{conversation.subject}</h3>
                  {(conversation.participants || []).slice(0, 2).map((participant) => (
                    <Badge key={participant.id} tone="slate">{participant.role.toLowerCase()}</Badge>
                  ))}
                </div>
                {(conversation.participants || []).length ? (
                  <p className="mt-2 text-xs font-bold uppercase text-slate-400">
                    {(conversation.participants || []).map((participant) => `${participant.name} (${participant.email})`).join(', ')}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{conversation.lastMessage?.body || 'No messages yet'}</p>
                {conversation.lastMessage?.createdAt ? (
                  <p className="mt-2 text-xs text-slate-400">Last activity {formatDate(conversation.lastMessage.createdAt)}</p>
                ) : null}
              </div>
              {conversation.unreadCount > 0 && (
                <span className="rounded-md bg-violet-500 px-3 py-1 text-xs font-black text-white">
                  {conversation.unreadCount} new
                </span>
              )}
            </div>
          </Link>
        ))}
        {conversations.length === 0 && <p className="p-6 text-slate-400">No conversations yet.</p>}
        {conversations.length > 0 && filtered.length === 0 && <p className="p-6 text-slate-400">No conversations match this view.</p>}
      </div>
    </section>
  );
}
