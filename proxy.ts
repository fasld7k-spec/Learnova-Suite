import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';
import { requestRedirectUrl } from './lib/redirect-url';

const protectedPrefixes = [
  '/admin',
  '/instructor',
  '/student',
  '/learn',
  '/cart',
  '/checkout/manual',
  '/calendar',
  '/messages',
  '/notifications',
  '/profile',
  '/invoice',
  '/community',
  '/dashboard'
];
const adminPrefixes = ['/admin', '/api/admin'];
const instructorPrefixes = ['/instructor'];
const studentPrefixes = ['/student'];
const studentCommercePrefixes = ['/cart', '/checkout/manual'];
const learnPrefixes = ['/learn'];
const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
const originCheckExemptPrefixes = ['/api/webhooks', '/api/license/activate', '/api/mobile-app'];
const rateLimitExemptPrefixes = ['/api/webhooks', '/api/license/activate'];
const mutationHits = new Map<string, { count: number; reset: number }>();
function contentSecurityPolicy(frameAncestors = "'self'") {
  const trackingScriptHosts = 'https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com';
  const scriptSrc = process.env.NODE_ENV === 'production'
    ? `script-src 'self' 'unsafe-inline' ${trackingScriptHosts}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${trackingScriptHosts}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https: ws: wss:",
    "frame-src 'self' https:",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

function embedFrameAncestors() {
  return (process.env.EMBED_FRAME_ANCESTORS || "'self'").trim() || "'self'";
}

function jwtSecret() {
  const value = process.env.JWT_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  return 'dev-secret-change-me';
}

function sameOriginUrl(value: string | null, expectedOrigin: string) {
  if (!value) return false;
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function requestOrigin(req: NextRequest) {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto || req.nextUrl.protocol.replace(':', '') || 'http';
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host');
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  const referer = req.headers.get('referer');
  const expectedOrigin = requestOrigin(req);

  if (origin) return origin === expectedOrigin;
  if (fetchSite) return ['same-origin', 'none'].includes(fetchSite);
  return sameOriginUrl(referer, expectedOrigin);
}

function withSecurityHeaders(response: NextResponse, path = '') {
  const isEmbedPath = matchesPathPrefix(path, '/embed');
  for (const [key, value] of Object.entries(securityHeaders)) response.headers.set(key, value);
  if (isEmbedPath) response.headers.delete('X-Frame-Options');
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(isEmbedPath ? embedFrameAncestors() : "'self'"));
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  return response;
}

function matchesPathPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function unauthorized(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return withSecurityHeaders(NextResponse.json({ success: false, message: 'Unauthenticated' }, { status: 401 }));
  }
  return withSecurityHeaders(NextResponse.redirect(requestRedirectUrl(req, '/login')));
}

function forbidden(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return withSecurityHeaders(NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 }));
  }
  return withSecurityHeaders(NextResponse.redirect(requestRedirectUrl(req, '/dashboard')));
}

function requestIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

function tooManyRequests() {
  return withSecurityHeaders(NextResponse.json({ success: false, message: 'Too many requests. Try again shortly.' }, { status: 429 }));
}

function withinRateLimit(key: string, limit = 80, windowMs = 60_000) {
  const now = Date.now();
  const hit = mutationHits.get(key);
  if (!hit || hit.reset < now) {
    mutationHits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}

function isPublicLearnPage(req: NextRequest) {
  return req.method === 'GET' && /^\/learn\/(?!quiz(?:\/|$))[^/]+\/?$/.test(req.nextUrl.pathname);
}

async function sessionRole(req: NextRequest) {
  const token = req.cookies.get('learnova_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret()));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const hostname = req.nextUrl.hostname;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  let verifiedRole: string | null | undefined;
  const getVerifiedRole = async () => {
    if (verifiedRole === undefined) verifiedRole = await sessionRole(req);
    return verifiedRole;
  };

  // Redirect HTTP → HTTPS in production
  if (
    process.env.NODE_ENV === 'production' &&
    !isLocalHost &&
    req.headers.get('x-forwarded-proto') === 'http'
  ) {
    const httpsUrl = req.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, { status: 301 });
  }

  if (
    path.startsWith('/api/') &&
    mutatingMethods.includes(req.method) &&
    !rateLimitExemptPrefixes.some((prefix) => matchesPathPrefix(path, prefix)) &&
    !withinRateLimit(`${requestIp(req)}:${path}`)
  ) {
    return tooManyRequests();
  }

  if (mutatingMethods.includes(req.method) && !originCheckExemptPrefixes.some((prefix) => matchesPathPrefix(path, prefix)) && !isSameOrigin(req)) {
    return withSecurityHeaders(NextResponse.json({ success: false, message: 'Invalid request origin' }, { status: 403 }));
  }

  const publicLearnPage = isPublicLearnPage(req);
  const protectedPath = !publicLearnPage && protectedPrefixes.some((prefix) => matchesPathPrefix(path, prefix));

  if (protectedPath) {
    const role = await getVerifiedRole();
    if (!role) return unauthorized(req);
  }

  if (adminPrefixes.some((prefix) => matchesPathPrefix(path, prefix))) {
    const role = await getVerifiedRole();
    if (!role) return unauthorized(req);
    if (role !== 'ADMIN') return forbidden(req);
  }

  if (instructorPrefixes.some((prefix) => matchesPathPrefix(path, prefix))) {
    const role = await getVerifiedRole();
    if (!role) return unauthorized(req);
    if (role !== 'INSTRUCTOR') return forbidden(req);
  }

  if (studentPrefixes.some((prefix) => matchesPathPrefix(path, prefix))) {
    const role = await getVerifiedRole();
    if (!role) return unauthorized(req);
    if (role !== 'STUDENT') return forbidden(req);
  }

  if (studentCommercePrefixes.some((prefix) => matchesPathPrefix(path, prefix))) {
    const role = await getVerifiedRole();
    if (!role) return unauthorized(req);
    if (role !== 'STUDENT' && role !== 'ADMIN') return forbidden(req);
  }

  if (!publicLearnPage && learnPrefixes.some((prefix) => matchesPathPrefix(path, prefix))) {
    const role = await getVerifiedRole();
    if (!role) return unauthorized(req);
    if (role !== 'STUDENT' && role !== 'ADMIN') return forbidden(req);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-learnova-pathname', path);
  return ensureCsrfCookie(req, withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), path));
}

// ---------------------------------------------------------------------------
// Helper: ensure CSRF token cookie is set on every response
// ---------------------------------------------------------------------------
function ensureCsrfCookie(req: NextRequest, response: NextResponse): NextResponse {
  if (!req.cookies.get('csrf_token')?.value) {
    response.cookies.set('csrf_token', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
};
