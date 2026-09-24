import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { listHas } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const STREAM_BATCH_SIZE = 50;
const MESSAGE_STREAM_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  body: true,
  read: true,
  createdAt: true
} as const;

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function parseSince(value: string | null) {
  if (!value) return new Date(0);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const conversationId = req.nextUrl.searchParams.get('conversationId') || '';
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userIds: listHas(session.id) },
    select: { id: true }
  });

  if (!conversation) return new Response('Conversation not found', { status: 404 });

  let since = parseSince(req.nextUrl.searchParams.get('since'));
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

      const pushMessages = async () => {
        try {
          const messages = await prisma.message.findMany({
            where: {
              conversationId,
              createdAt: { gt: since }
            },
            select: MESSAGE_STREAM_SELECT,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: STREAM_BATCH_SIZE
          });

          if (!messages.length) return;
          since = messages[messages.length - 1].createdAt;
          enqueue(sse('messages', messages));
        } catch {
          enqueue(sse('error', { message: 'Message stream temporarily unavailable.' }));
        }
      };

      enqueue(sse('connected', { conversationId, at: new Date().toISOString() }));
      void pushMessages();

      const pollInterval = setInterval(pushMessages, 2_000);
      const heartbeatInterval = setInterval(() => enqueue(': ping\n\n'), 25_000);

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
