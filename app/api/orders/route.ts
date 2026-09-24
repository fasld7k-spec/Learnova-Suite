/**
 * GET /api/orders — paginated list of orders for the current user
 *
 * Query params:
 *   page     — 1-based page number (default 1)
 *   pageSize — items per page (default 20, max 100)
 *   cursor   — opaque cursor for cursor-based pagination on large result sets
 *
 * Requirements: 10.5, 10.6, 10.7
 */
import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleError, ok } from '@/lib/api';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const ORDER_SELECT = {
  id: true,
  invoiceNumber: true,
  total: true,
  currency: true,
  status: true,
  gateway: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      courseId: true,
      title: true,
      price: true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);

    const params = req.nextUrl.searchParams;

    const rawPage = parseInt(params.get('page') ?? '1', 10);
    const rawPageSize = parseInt(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
    const cursor = params.get('cursor') ?? undefined;

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const where = { userId: user.id };

    // Cursor-based pagination for large order lists (Req 10.7)
    if (cursor) {
      const items = await prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        take: pageSize + 1,
        cursor: { id: cursor },
        skip: 1,
      });

      const hasMore = items.length > pageSize;
      const data = hasMore ? items.slice(0, pageSize) : items;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
      const total = await prisma.order.count({ where });

      return ok({ data, total, page, pageSize, hasMore, nextCursor });
    }

    // Offset-based pagination (Req 10.6)
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    const hasMore = page * pageSize < total;
    return ok({ data, total, page, pageSize, hasMore });
  } catch (e) {
    return handleError(e);
  }
}
