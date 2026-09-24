'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Bell, Check, Filter, Search, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { classifyNotification } from '@/lib/communication';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string | Date;
};

type InboxFilter = 'all' | 'unread' | 'read';

function formatDate(date: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale || 'en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(date));
}

export function RealtimeNotificationInbox({ initialRows, locale, csrfToken }: { initialRows: NotificationItem[]; locale: string; csrfToken: string }) {
  const [rows, setRows] = useState(() => initialRows.map((row) => ({ ...row, createdAt: String(row.createdAt) })));
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const source = new EventSource('/api/notifications/stream');
    source.addEventListener('connected', () => setLive(true));
    source.addEventListener('notifications', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { notifications: NotificationItem[] };
      setRows((current) => {
        const seen = new Set(current.map((item) => item.id));
        const merged = [...current];
        for (const notification of payload.notifications || []) {
          if (!seen.has(notification.id)) merged.unshift({ ...notification, createdAt: String(notification.createdAt) });
        }
        return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      setLive(true);
    });
    source.onerror = () => setLive(false);
    return () => source.close();
  }, []);

  async function markRead(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const response = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ id, csrfToken })
    });
    if (response.ok) {
      setRows((current) => current.map((row) => row.id === id ? { ...row, read: true } : row));
    }
  }

  async function markAllRead() {
    const response = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ all: true, csrfToken })
    });
    if (response.ok) setRows((current) => current.map((row) => ({ ...row, read: true })));
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (filter === 'unread' && row.read) return false;
    if (filter === 'read' && !row.read) return false;
    if (!normalizedQuery) return true;
    return `${row.title} ${row.body} ${classifyNotification(row).label}`.toLowerCase().includes(normalizedQuery);
  });
  const unreadCount = rows.filter((row) => !row.read).length;

  if (rows.length === 0) {
    return (
      <div className="moe-panel p-8 text-center">
        <Bell className="mx-auto text-violet-200" size={34} />
        <h2 className="mt-4 text-xl font-black text-white">No notifications yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
          New course announcements, payment updates, certificates, and live class reminders will appear here.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="moe-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Priority notification inbox</h2>
            <p className="mt-1 text-sm text-slate-300">Search, filter, and clear near-realtime in-app alerts without leaving the dashboard.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={unreadCount ? 'yellow' : 'green'}>{unreadCount} unread</Badge>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              {live ? <Wifi size={15} className="text-emerald-300" /> : <WifiOff size={15} className="text-amber-300" />}
              {live ? 'Near-realtime in-app notifications enabled' : 'Reconnecting in-app notifications'}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="moe-control w-full pl-10"
              placeholder="Search title, body, or category"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            {(['all', 'unread', 'read'] as const).map((mode) => (
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
          <button className="moe-control justify-center px-4 disabled:cursor-not-allowed disabled:opacity-50" disabled={!unreadCount} onClick={markAllRead} type="button">
            <Check size={16} />
            Mark all read
          </button>
        </div>
      </div>
      {filteredRows.map((notification) => {
        const category = classifyNotification(notification);
        return (
        <article key={notification.id} className={`rounded-md border p-5 ${notification.read ? 'border-violet-300/15 bg-white/[0.03]' : 'border-violet-300/45 bg-violet-500/15'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-white">{notification.title}</h3>
                <Badge tone={notification.read ? 'slate' : 'blue'}>{notification.read ? 'Read' : 'New'}</Badge>
                <Badge tone={category.tone}>{category.label}</Badge>
              </div>
              <p className="mt-2 leading-7 text-slate-200">{notification.body}</p>
              <p className="mt-3 text-xs font-bold uppercase text-slate-400">{formatDate(notification.createdAt, locale)}</p>
            </div>
            {!notification.read ? (
              <form onSubmit={(event) => markRead(event, notification.id)}>
                <button className="moe-control whitespace-nowrap px-4">
                  <Check size={16} />
                  Mark read
                </button>
              </form>
            ) : null}
          </div>
        </article>
      );})}
      {rows.length > 0 && filteredRows.length === 0 ? <p className="moe-panel p-6 text-slate-400">No notifications match this view.</p> : null}
    </section>
  );
}
