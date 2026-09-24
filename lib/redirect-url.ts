import type { NextRequest } from 'next/server';
import { appUrlFromRequest, normalizeAppUrl } from './app-url';

export function requestRedirectUrl(req: NextRequest, path: string, configured?: string | null) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const origin = normalizeAppUrl(configured) || appUrlFromRequest(req);
  return new URL(safePath, origin);
}
