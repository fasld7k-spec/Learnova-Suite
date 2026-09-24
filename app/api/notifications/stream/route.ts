import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const STREAM_BATCH_SIZE = 50;
const NOTIFICATION_STREAM_SELECT = {
  id: true,
  title: true,
  body: true,
  read: true,
  createdAt: true
} as const;

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const userId = session.id;
  let lastSent = new Date(0);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Client disconnected.
        }
      };

      const pushNotifications = async () => {
        try {
          const notifications = await prisma.notification.findMany({
            where: { userId, read: false, createdAt: { gt: lastSent } },
            select: NOTIFICATION_STREAM_SELECT,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: STREAM_BATCH_SIZE
          });

          const unreadCount = await prisma.notification.count({ where: { userId, read: false } });
          if (notifications.length) lastSent = notifications[notifications.length - 1].createdAt;
          if (notifications.length) enqueue(sse('notifications', { notifications, unreadCount }));
        } catch {
          enqueue(sse('error', { message: 'Notification stream temporarily unavailable.' }));
        }
      };

      void (async () => {
        const unreadCount = await prisma.notification.count({ where: { userId, read: false } }).catch(() => 0);
        enqueue(sse('connected', { unreadCount }));
      })();

      const pollInterval = setInterval(pushNotifications, 5_000);
      const heartbeatInterval = setInterval(() => enqueue(': ping\n\n'), 30_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
