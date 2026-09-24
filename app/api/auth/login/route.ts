import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authCookieName, clearCookieOptions, createToken, createTwoFactorChallengeToken, secureCookieOptions, twoFactorChallengeCookieName, verifyPassword, type Role } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';
import { fail } from '@/lib/api';
import { rateLimit, resetRateLimit } from '@/lib/rate-limit';
import { verifyTOTP, decryptSecret } from '@/lib/2fa';
import { logAuditEvent } from '@/lib/audit-log';
import { dispatchEmail } from '@/lib/email';
import { requestRedirectUrl } from '@/lib/redirect-url';

/** Max failed login attempts per user before temporary rate limiting (Req 11.6) */
const MAX_FAILED_ATTEMPTS = 5;
/** Rate-limit duration in milliseconds: 15 minutes (Req 11.6) */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = '$2a$12$IeeBglXrijDy1m3ROpJfzeoHAwyPQQVacWh734LUkTsj24/k0MnFi';

function requestIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

export async function POST(req: NextRequest) {
  const ip = requestIp(req);

  // IP-level rate limit (existing guard)
  const ipLimited = rateLimit(`auth.login:${ip}`, 8, 60_000);
  if (!ipLimited.ok) return fail('Too many login attempts. Try again in a minute.', 429);

  const contentType = req.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await req.json().catch(() => ({}))
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) return fail('Validation error', 422, parsed.error.flatten());

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const userAgent = req.headers.get('user-agent') || '';

  const passwordMatches = await verifyPassword(parsed.data.password, user?.passwordHash || DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    // Per-user failed attempt tracking (Req 11.6)
    if (user) {
      const userKey = `auth.login.user:${user.id}`;
      const userLimited = rateLimit(userKey, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS);

      if (!userLimited.ok) {
        // Threshold breached - alert and rely on rate limiting instead of permanently changing account status.
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

        void logAuditEvent({
          action: 'auth.login.rate_limited',
          userId: user.id,
          ip,
          entity: 'User',
          entityId: user.id,
          details: { email: user.email, lockedUntil: lockedUntil.toISOString(), reason: 'Too many failed login attempts' },
        });

        void dispatchEmail({
          to: user.email,
          templateKey: 'security-alert',
          variables: {
            name: user.name,
            event: 'Too many failed login attempts were detected for your account.',
            ip,
            time: new Date().toISOString(),
          },
          locale: user.locale,
        }).catch(() => null);
      }
    }

    await prisma.loginHistory.create({ data: { email: parsed.data.email, ip, userAgent, success: false } }).catch(() => null);

    void logAuditEvent({
      action: 'auth.login.failure',
      userId: user?.id ?? null,
      ip,
      entity: 'User',
      entityId: user?.id ?? null,
      details: { email: parsed.data.email, reason: 'Invalid credentials' },
    });

    return fail('Invalid credentials', 401);
  }

  // Respect explicit admin moderation status.
  if (user.status === 'SUSPENDED') {
    await prisma.loginHistory.create({ data: { email: user.email, userId: user.id, ip, userAgent, success: false } }).catch(() => null);
    void logAuditEvent({
      action: 'auth.login.failure',
      userId: user.id,
      ip,
      entity: 'User',
      entityId: user.id,
      details: { email: user.email, reason: 'Account suspended' },
    });
    return fail('Account is temporarily locked. Please try again later or contact support.', 403);
  }

  if (user.status === 'REJECTED') {
    await prisma.loginHistory.create({ data: { email: user.email, userId: user.id, ip, userAgent, success: false } }).catch(() => null);
    void logAuditEvent({
      action: 'auth.login.failure',
      userId: user.id,
      ip,
      entity: 'User',
      entityId: user.id,
      details: { email: user.email, reason: 'Account rejected' },
    });
    return fail('Account is not active', 403);
  }

  // Successful credential check - reset per-user failed attempt counter
  resetRateLimit(`auth.login.user:${user.id}`);

  // Check if 2FA is enabled for this user
  const twoFactor = await prisma.twoFactorAuth.findFirst({
    where: { userId: user.id, enabled: true },
  });

  if (twoFactor) {
    const { totpToken } = parsed.data;

    // No TOTP token provided - signal the frontend to prompt for it
    if (!totpToken) {
      await prisma.loginHistory.create({ data: { email: user.email, userId: user.id, ip, userAgent, success: false } }).catch(() => null);
      const challenge = await createTwoFactorChallengeToken({ id: user.id, email: user.email, passwordHash: user.passwordHash });
      const challengeResponse = NextResponse.json({ requiresTwoFactor: true, userId: user.id }, { status: 200 });
      challengeResponse.cookies.set(twoFactorChallengeCookieName, challenge, secureCookieOptions(10 * 60));
      return challengeResponse;
    }

    // TOTP token provided - verify it
    let secret: string;
    try {
      secret = decryptSecret(twoFactor.secret);
    } catch {
      return fail('Internal error verifying 2FA', 500);
    }

    const valid = verifyTOTP(totpToken, secret);
    if (!valid) {
      await prisma.loginHistory.create({ data: { email: user.email, userId: user.id, ip, userAgent, success: false } }).catch(() => null);
      void logAuditEvent({
        action: 'auth.login.failure',
        userId: user.id,
        ip,
        entity: 'User',
        entityId: user.id,
        details: { email: user.email, reason: 'Invalid TOTP token' },
      });
      return fail('Invalid TOTP token', 401);
    }
  }

  // Credentials (and TOTP if required) are valid - issue session cookie
  await prisma.loginHistory.create({ data: { email: user.email, userId: user.id, ip, userAgent, success: true } }).catch(() => null);

  void logAuditEvent({
    action: 'auth.login.success',
    userId: user.id,
    ip,
    entity: 'User',
    entityId: user.id,
    details: { email: user.email },
  });

  const token = await createToken({ id: user.id, email: user.email, role: user.role as Role });
  const res = NextResponse.redirect(requestRedirectUrl(req, '/dashboard'), 303);
  res.cookies.set(authCookieName, token, secureCookieOptions());
  res.cookies.set(twoFactorChallengeCookieName, '', clearCookieOptions());
  return res;
}
