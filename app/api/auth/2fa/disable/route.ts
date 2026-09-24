/**
 * POST /api/auth/2fa/disable
 *
 * Authenticated endpoint that disables 2FA for the current user.
 * Requires a valid TOTP token to confirm the action.
 * On success, clears the secret and backup codes and sets enabled: false.
 *
 * Requirements: 8.9
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import { decryptSecret, verifyTOTP } from '@/lib/2fa';
import { logAuditEvent } from '@/lib/audit-log';
import { verifyCsrf } from '@/lib/csrf';
import { enforceRateLimit } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  // 1. Require an authenticated session
  const session = await getSession();
  if (!session) return fail('Unauthenticated', 401);

  const limited = enforceRateLimit(req, `auth.2fa.disable:${session.id}`, 5, 10 * 60_000);
  if (limited) return limited;

  // 2. Parse and validate the request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body', 400);
  }

  const { token, csrfToken } = body as { token?: unknown; csrfToken?: unknown };
  if (!(await verifyCsrf(req.headers.get('x-csrf-token') || (typeof csrfToken === 'string' ? csrfToken : '')))) {
    return fail('Invalid CSRF token.', 403);
  }
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return fail('token must be a 6-digit string', 400);
  }

  // 3. Fetch the user's TwoFactorAuth record
  const twoFa = await prisma.twoFactorAuth.findUnique({
    where: { userId: session.id },
  });

  if (!twoFa) {
    return fail('2FA is not set up for this account', 400);
  }

  if (!twoFa.enabled) {
    return fail('2FA is not currently enabled', 400);
  }

  // 4. Decrypt the stored secret
  let secret: string;
  try {
    secret = decryptSecret(twoFa.secret);
  } catch {
    return fail('Failed to decrypt 2FA secret', 500);
  }

  // 5. Verify the TOTP token
  const isValid = verifyTOTP(token, secret);
  if (!isValid) {
    return fail('Invalid or expired token', 400);
  }

  // 6. Disable 2FA, clear secret and backup codes, set enabled: false
  await prisma.twoFactorAuth.update({
    where: { userId: session.id },
    data: {
      enabled: false,
      secret: '',
      backupCodes: JSON.stringify([]),
    },
  });

  void logAuditEvent({
    action: 'auth.2fa.disabled',
    userId: session.id,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local',
    entity: 'TwoFactorAuth',
    entityId: session.id,
    details: { email: session.email },
  });

  return ok({ message: '2FA has been disabled' });
}
