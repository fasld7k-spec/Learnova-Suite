import type { NextRequest } from 'next/server';

const localAppUrl = 'http://localhost:3000';

function firstHeaderValue(value?: string | null) {
  return String(value || '').split(',')[0]?.trim() || '';
}

export function normalizeAppUrl(value?: unknown) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return '';

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function configuredAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAppUrl(candidate);
    if (normalized) return normalized;
  }

  return '';
}

export function appUrlFromHeaders(headers: Pick<Headers, 'get'>) {
  const forwardedHost = firstHeaderValue(headers.get('x-forwarded-host'));
  const host = forwardedHost || firstHeaderValue(headers.get('host'));
  if (!host) return '';

  if (/^https?:\/\//i.test(host)) return normalizeAppUrl(host);

  const forwardedProto = firstHeaderValue(headers.get('x-forwarded-proto'));
  const proto = forwardedProto || (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return normalizeAppUrl(`${proto}://${host}`);
}

export function appUrlFromRequest(req: NextRequest, configured?: string | null) {
  return resolveAppUrl({
    configured,
    headers: req.headers,
    requestOrigin: req.nextUrl.origin,
  });
}

export function resolveAppUrl({
  configured,
  headers,
  requestOrigin,
  fallback = localAppUrl,
}: {
  configured?: string | null;
  headers?: Pick<Headers, 'get'>;
  requestOrigin?: string;
  fallback?: string;
} = {}) {
  // Configured URLs win over request headers: Host / X-Forwarded-Host are client-controlled
  // and must not decide where password-reset or payment links point.
  return (
    normalizeAppUrl(configured) ||
    configuredAppUrl() ||
    (headers ? appUrlFromHeaders(headers) : '') ||
    normalizeAppUrl(requestOrigin) ||
    normalizeAppUrl(fallback) ||
    localAppUrl
  );
}
