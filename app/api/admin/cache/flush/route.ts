/**
 * app/api/admin/cache/flush/route.ts
 *
 * Admin API route to manually invalidate a specific cache key.
 * Accepts POST { key: string } and calls invalidateCache(key).
 *
 * Requirements: 7.10
 */

import { handleError, ok, fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { clearCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['ADMIN']);

    let body: { key?: string };
    try {
      body = await req.json();
    } catch {
      return fail('Invalid JSON body', 400);
    }
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || (body as any).csrfToken || ''))) return fail('Invalid CSRF token.', 403);

    const { key } = body;
    if (!key || typeof key !== 'string' || key.trim() === '') {
      return fail('Missing or invalid cache key', 400);
    }

    const result = await clearCache([key.trim()]);

    await audit({
      actorId: user.id,
      action: 'cache.flush',
      entity: 'System',
      metadata: { key: key.trim(), deleted: result.deleted },
    });

    return ok({ flushed: true, key: key.trim(), deleted: result.deleted });
  } catch (e) {
    return handleError(e);
  }
}
