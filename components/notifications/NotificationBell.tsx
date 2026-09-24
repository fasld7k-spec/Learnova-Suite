'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

type NotificationPayload = {
  unreadCount?: number;
  notifications?: Array<{ id: string; title: string; body: string }>;
};

export function NotificationBell({ href = '/notifications', initialUnreadCount = 0 }: { href?: string; initialUnreadCount?: number }) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [latestTitle, setLatestTitle] = useState('');

  useEffect(() => {
    const source = new EventSource('/api/notifications/stream');

    const update = (event: Event) => {
      const payload = JSON.parse((event as MessageEvent).data) as NotificationPayload;
      if (typeof payload.unreadCount === 'number') setUnreadCount(payload.unreadCount);
      const latest = payload.notifications?.[payload.notifications.length - 1];
      if (latest) setLatestTitle(latest.title);
    };

    source.addEventListener('connected', update);
    source.addEventListener('notifications', update);

    return () => source.close();
  }, []);

  return (
    <Link
      className="btn-ghost relative min-h-9 px-3"
      href={href}
      aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
      title={latestTitle || 'Notifications'}
    >
      <Bell size={17} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#F4212E] px-1 text-[11px] font-black leading-none text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
