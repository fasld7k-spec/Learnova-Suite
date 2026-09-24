/**
 * GET  /api/courses  — public course catalog (published courses only)
 * POST /api/courses  — create a new course (instructor/admin)
 *
 * Pagination params (GET):
 *   page     — 1-based page number (default 1)
 *   pageSize — items per page (default 20, max 100)
 *   cursor   — opaque cursor for cursor-based pagination on large result sets
 *
 * Requirements: 10.5, 10.6, 10.7
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { courseSchema } from '@/lib/validators';
import { toList } from '@/lib/json-fields';
import { getCached, invalidateCourseCatalogCache } from '@/lib/cache';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Explicit field list — avoids fetching unused columns (Req 10.5) */
const CATALOG_SELECT = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  coverImage: true,
  price: true,
  salePrice: true,
  language: true,
  level: true,
  durationMinutes: true,
  isFree: true,
  includesCertificate: true,
  status: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      slug: true,
    },
  },
  instructor: {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const rawPage = parseInt(params.get('page') ?? '1', 10);
  const rawPageSize = parseInt(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
  const cursor = params.get('cursor') ?? undefined;

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(rawPageSize, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  // Use cursor-based pagination when a cursor is provided (Req 10.7)
  if (cursor) {
    const items = await prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: CATALOG_SELECT,
      orderBy: { createdAt: 'desc' },
      take: pageSize + 1,
      cursor: { id: cursor },
      skip: 1, // skip the cursor item itself
    });

    const hasMore = items.length > pageSize;
    const data = hasMore ? items.slice(0, pageSize) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    const total = await getCached(
      'courses:catalog:count',
      () => prisma.course.count({ where: { status: 'PUBLISHED' } }),
      { ttlSeconds: 300, staleSeconds: 300, tags: ['courses', 'catalog'] },
    );

    return ok({ data, total, page, pageSize, hasMore, nextCursor });
  }

  // Offset-based pagination (Req 10.6)
  const [data, total] = await Promise.all([
    getCached(
      `courses:catalog:page:${page}:${pageSize}`,
      () =>
        prisma.course.findMany({
          where: { status: 'PUBLISHED' },
          select: CATALOG_SELECT,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      { ttlSeconds: 300, staleSeconds: 300, tags: ['courses', 'catalog'] },
    ),
    getCached(
      'courses:catalog:count',
      () => prisma.course.count({ where: { status: 'PUBLISHED' } }),
      { ttlSeconds: 300, staleSeconds: 300, tags: ['courses', 'catalog'] },
    ),
  ]);

  const hasMore = page * pageSize < total;
  return ok({ data, total, page, pageSize, hasMore });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['INSTRUCTOR', 'ADMIN']);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return fail('Invalid course request.', 422);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String((body as { csrfToken?: unknown }).csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const parsed = courseSchema.safeParse(body);
    if (!parsed.success) return fail('Validation error', 422, parsed.error.flatten());
    const course = await prisma.course.create({
      data: {
        ...parsed.data,
        requirements: toList(parsed.data.requirements),
        outcomes: toList(parsed.data.outcomes),
        instructorId: user.id,
        status: user.role === 'ADMIN' ? 'PUBLISHED' : 'PENDING',
      },
    });
    if (course.status === 'PUBLISHED') await invalidateCourseCatalogCache();
    return ok(course, 201);
  } catch (e) {
    return handleError(e);
  }
}
