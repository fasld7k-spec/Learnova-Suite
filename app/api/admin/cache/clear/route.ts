import { NextRequest, NextResponse } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { CACHE_REGISTRY, clearCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';

const CLEAR_KEYS = CACHE_REGISTRY.map((item) => item.key);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['ADMIN']);
    const form = req.headers.get('content-type')?.includes('application/json') ? null : await req.formData().catch(() => null);
    const json = form ? null : await req.json().catch(() => ({}));
    if (!(await verifyCsrf(String(form?.get('csrfToken') || json?.csrfToken || req.headers.get('x-csrf-token') || '')))) return fail('Invalid CSRF token.', 403);

    const result = await clearCache(CLEAR_KEYS);
    await audit({
      actorId: user.id,
      action: 'cache.clear',
      entity: 'System',
      metadata: {
        provider: process.env.REDIS_URL ? 'redis' : 'in-process-cache',
        keys: result.flushed,
        deleted: result.deleted,
      },
    });

    const payload = {
      cleared: true,
      deleted: result.deleted,
      flushed: result.flushed,
      message: `Cache clear completed for ${result.flushed.length} key group(s).`,
    };

    if (!req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.redirect(new URL('/admin/cache?cleared=1', req.url), 303);
    }
    return ok(payload);
  } catch (error) {
    return handleError(error);
  }
}
