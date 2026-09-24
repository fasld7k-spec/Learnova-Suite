import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { CACHE_REGISTRY, clearCache, getCacheOverview, getCached } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { getHomeSectionSettings } from '@/lib/home-sections';
import { fetchSiteSettings } from '@/lib/site-settings';
import { prisma } from '@/lib/prisma';

function cacheRegistryKeys() {
  return CACHE_REGISTRY.map((item) => item.key);
}

async function warmKnownKey(key: string) {
  if (key === 'site:settings') {
    await getCached('site:settings', () => fetchSiteSettings(), { ttlSeconds: 60, staleSeconds: 120, tags: ['settings', 'site', 'theme'] });
    return { warmed: key };
  }

  if (key === 'courses:catalog:all') {
    await getCached(
      'courses:catalog:all',
      () => prisma.course.findMany({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 24 }),
      { ttlSeconds: 300, staleSeconds: 300, tags: ['courses', 'catalog'] },
    );
    return { warmed: key };
  }

  if (key === 'courses:catalog:count') {
    await getCached(
      'courses:catalog:count',
      () => prisma.course.count({ where: { status: 'PUBLISHED' } }),
      { ttlSeconds: 300, staleSeconds: 300, tags: ['courses', 'catalog'] },
    );
    return { warmed: key };
  }

  if (key === 'home:page') {
    await getCached(
      'home:page',
      async () => {
        const [courses, sliders, categories, instructors, reviews, settings, homeSections] = await Promise.all([
          prisma.course.findMany({
            where: { status: 'PUBLISHED' },
            take: 8,
            include: { category: true, instructor: true, enrollments: true, reviews: true },
            orderBy: { createdAt: 'desc' },
          }),
          (prisma as any).slider.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, take: 1 }).catch(() => []),
          prisma.category.findMany({ include: { _count: { select: { courses: true } } }, orderBy: { nameEn: 'asc' }, take: 6 }).catch(() => []),
          prisma.user.findMany({ where: { role: 'INSTRUCTOR', status: 'APPROVED' }, take: 4, orderBy: { createdAt: 'desc' } }).catch(() => []),
          prisma.review.findMany({ include: { user: true, course: true }, orderBy: { createdAt: 'desc' }, take: 3 }).catch(() => []),
          fetchSiteSettings(),
          getHomeSectionSettings(),
        ]);

        return { courses, sliders, categories, instructors, reviews, settings, homeSections };
      },
      { ttlSeconds: 120, staleSeconds: 180, tags: ['home', 'courses', 'settings', 'theme'] },
    );
    return { warmed: key };
  }

  return { skipped: key, reason: 'This key is a pattern or does not have a safe warmer.' };
}

async function warmRegistry() {
  const results = [];
  for (const item of CACHE_REGISTRY) {
    if (item.wildcard) {
      results.push({ skipped: item.key, reason: 'Wildcard keys are populated by traffic and are not warmed directly.' });
      continue;
    }
    results.push(await warmKnownKey(item.key));
  }

  return {
    warmed: results.filter((result) => 'warmed' in result).map((result) => result.warmed),
    skipped: results.filter((result) => 'skipped' in result).map((result) => ({ key: result.skipped, reason: result.reason })),
  };
}

export async function GET() {
  try {
    await requireUser(['ADMIN']);
    return ok(await getCacheOverview(CACHE_REGISTRY));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['ADMIN']);
    const body = await req.json().catch(() => ({}));
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || body.csrfToken || ''))) return fail('Invalid CSRF token.', 403);

    const action = typeof body.action === 'string' ? body.action.trim() : '';
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const tag = typeof body.tag === 'string' ? body.tag.trim() : '';

    if (action === 'warm') {
      if (!key) return fail('key is required', 400);
      const result = await warmKnownKey(key);
      await audit({ actorId: user.id, action: 'cache.warm', entity: 'System', metadata: result });
      return ok(result);
    }

    if (action === 'warm_all') {
      const result = await warmRegistry();
      await audit({ actorId: user.id, action: 'cache.warm_all', entity: 'System', metadata: result });
      return ok(result);
    }

    if (action === 'flush_tag') {
      if (!tag) return fail('tag is required', 400);
      const result = await clearCache([`tag:${tag}`]);
      await audit({ actorId: user.id, action: 'cache.flush_tag', entity: 'System', metadata: { tag, deleted: result.deleted } });
      return ok(result);
    }

    if (action === 'flush_all') {
      const result = await clearCache(cacheRegistryKeys());
      await audit({ actorId: user.id, action: 'cache.flush_all', entity: 'System', metadata: { keys: result.flushed, deleted: result.deleted } });
      return ok(result);
    }

    return fail('Unsupported cache action.', 422);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(['ADMIN']);
    const body = await req.json().catch(() => ({}));
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || body.csrfToken || ''))) return fail('Invalid CSRF token.', 403);

    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!key) return fail('key is required', 400);

    const result = await clearCache(key === '*' ? cacheRegistryKeys() : [key]);
    await audit({
      actorId: user.id,
      action: 'cache.flush',
      entity: 'System',
      metadata: { keys: result.flushed, deleted: result.deleted },
    });

    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
