import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';

export function wantsJson(req: NextRequest) {
  return req.headers.get('accept')?.includes('application/json') || req.headers.get('content-type')?.includes('application/json');
}

export function formFail(req: NextRequest, message: string, status = 422, fallbackPath = '/') {
  if (wantsJson(req)) return fail(message, status);
  const referrer = req.headers.get('referer');
  const url = referrer ? new URL(referrer) : new URL(fallbackPath, req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}
