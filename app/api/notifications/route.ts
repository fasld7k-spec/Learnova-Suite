/**
 * GET /api/notifications — paginated list of notifications for the current user
 *
 * Query params:
 *   page     — 1-based page number (default 1)
 *   pageSize — items per page (default 20, max 100)
 *   cursor   — opaque cursor for cursor-based pagination on large result sets
 *   unread   — if "true", return only unread notifications
 *
 * Requirements: 10.5, 10.6, 10.7
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/api';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  body: true,
  read: true,
  createdAt: true,
} as const;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail('Unauthenticated', 401);

  const params = req.nextUrl.searchParams;

  const rawPage = parseInt(params.get('page') ?? '1', 10);
  const rawPageSize = parseInt(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
  const cursor = params.get('cursor') ?? undefined;
  const unreadOnly = params.get('unread') === 'true';

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(rawPageSize, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  const where = {
    userId: session.id,
    ...(unreadOnly ? { read: false } : {}),
  };

  // Cursor-based pagination for large notification lists (Req 10.7)
  if (cursor) {
    const items = await prisma.notification.findMany({
      where,
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: pageSize + 1,
      cursor: { id: cursor },
      skip: 1,
    });

    const hasMore = items.length > pageSize;
    const data = hasMore ? items.slice(0, pageSize) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
    const total = await prisma.notification.count({ where });

    return ok({ data, total, page, pageSize, hasMore, nextCursor });
  }

  // Offset-based pagination (Req 10.6)
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  const hasMore = page * pageSize < total;
  return ok({ data, total, page, pageSize, hasMore });
}
