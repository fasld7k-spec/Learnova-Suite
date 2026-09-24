'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Clock, Send, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { applyMessagePriority, priorityFromMessage, type MessagePriority } from '@/lib/communication';

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  read: boolean;
  createdAt: string | Date;
};

function formatTime(value: string | Date) {
  return new Date(value).toLocaleString();
}

const quickReplies = [
  'Thanks for the update. I will review this and reply shortly.',
  'Could you share a screenshot or more details so I can help faster?',
  'This is resolved from my side. Please confirm when you have checked it.'
];

export function RealtimeChat({
  conversationId,
  currentUserId,
  initialMessages,
  csrfToken
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
  csrfToken: string;
}) {
  const [messages, setMessages] = useState(() => initialMessages.map((message) => ({ ...message, createdAt: String(message.createdAt) })));
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<MessagePriority>('normal');
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const latestCreatedAtRef = useRef(messages[messages.length - 1]?.createdAt ? new Date(messages[messages.length - 1].createdAt).toISOString() : new Date(0).toISOString());

  useEffect(() => {
    const url = `/api/messages/stream?conversationId=${encodeURIComponent(conversationId)}&since=${encodeURIComponent(latestCreatedAtRef.current)}`;
    const source = new EventSource(url);

    source.addEventListener('connected', () => setStatus('live'));
    source.addEventListener('messages', (event) => {
      const incoming = JSON.parse((event as MessageEvent).data) as ChatMessage[];
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id));
        const merged = [...current];
        for (const message of incoming) {
          if (!seen.has(message.id)) merged.push({ ...message, createdAt: String(message.createdAt) });
        }
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const latest = merged[merged.length - 1]?.createdAt;
        if (latest) latestCreatedAtRef.current = new Date(latest).toISOString();
        return merged;
      });
      setStatus('live');
    });
    source.onerror = () => setStatus('offline');

    return () => source.close();
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    const finalText = applyMessagePriority(text, priority);

    setSending(true);
    try {
      const response = await fetch('/api/messages/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ conversationId, body: finalText, csrfToken })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Message failed.');
      const createdAt = String(payload.data.message.createdAt);
      latestCreatedAtRef.current = new Date(createdAt).toISOString();
      setMessages((current) => [...current, { ...payload.data.message, createdAt }]);
      setBody('');
      setPriority('normal');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="moe-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-300/15 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          {status === 'live' ? <Wifi size={17} className="text-emerald-300" /> : <WifiOff size={17} className="text-amber-300" />}
          {status === 'live' ? 'Near-realtime in-app chat is live' : status === 'connecting' ? 'Connecting near-realtime in-app chat' : 'Reconnecting near-realtime in-app chat'}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Bell size={15} />
          Messages appear in-app through the server event stream; this is not WebPush or a WebSocket channel.
        </div>
      </div>

      <div className="grid gap-3 border-b border-violet-300/15 p-4 md:grid-cols-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Sparkles size={16} className="text-violet-200" />
          Thread controls
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock size={16} />
          {messages.length ? `Last message ${formatTime(messages[messages.length - 1].createdAt)}` : 'No messages yet'}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <CheckCheck size={16} />
          {messages.filter((message) => message.senderId !== currentUserId && !message.read).length} unread from others
        </div>
      </div>

      <div className="grid max-h-[62vh] gap-3 overflow-y-auto p-4">
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div
              key={message.id}
              className={`max-w-[86%] rounded-md border p-4 ${mine ? 'ml-auto border-violet-300/45 bg-violet-500/15' : 'mr-auto border-violet-300/15 bg-white/[0.04]'}`}
            >
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white">{message.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <small className="block text-xs text-slate-400">{formatTime(message.createdAt)}</small>
                {mine ? <Badge tone={message.read ? 'green' : 'slate'}>{message.read ? 'Read' : 'Sent'}</Badge> : null}
                {priorityFromMessage(message.body) === 'urgent' ? <Badge tone="red">Urgent</Badge> : null}
                {priorityFromMessage(message.body) === 'important' ? <Badge tone="yellow">Important</Badge> : null}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form className="grid gap-3 border-t border-violet-300/15 p-4" onSubmit={submit}>
        <div className="flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <button
              className="rounded-md border border-violet-300/15 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-violet-300/40 hover:bg-violet-400/10 hover:text-violet-100"
              key={reply}
              onClick={() => setBody(reply)}
              type="button"
            >
              {reply}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
          <select className="moe-control" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
          <textarea
            className="moe-control min-h-16"
            placeholder="Write a reply. Ctrl+Enter sends."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="moe-primary h-fit justify-center disabled:cursor-not-allowed disabled:opacity-50" disabled={sending || !body.trim()}>
            <Send size={17} />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <p className="text-xs font-bold uppercase text-slate-400">{body.length} characters</p>
      </form>
    </section>
  );
}
