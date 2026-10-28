/**
 * POST /api/auth/2fa/verify
 *
 * Verifies a TOTP token submitted during 2FA setup.
 * On success, enables 2FA for the user and returns 10 one-time backup codes.
 *
 * Requirements: 8.2, 8.3
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok, fail } from '@/lib/api';
import {
  decryptSecret,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
} from '@/lib/2fa';
import { logAuditEvent } from '@/lib/audit-log';
import { verifyCsrf } from '@/lib/csrf';
import { enforceRateLimit } from '@/lib/request-security';
import { clientIp } from '@/lib/client-ip';

export async function POST(req: NextRequest) {
  // 1. Require an authenticated session
  const session = await getSession();
  if (!session) return fail('Unauthenticated', 401);

  const limited = enforceRateLimit(req, `auth.2fa.verify:${session.id}`, 5, 10 * 60_000);
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
    return fail('2FA setup not initiated', 400);
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

  // 6. Generate and hash 10 backup codes
  const plainCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(plainCodes.map(hashBackupCode));

  // 7. Persist hashed backup codes and enable 2FA
  await prisma.twoFactorAuth.update({
    where: { userId: session.id },
    data: {
      backupCodes: JSON.stringify(hashedCodes),
      enabled: true,
    },
  });

  void logAuditEvent({
    action: 'auth.2fa.enabled',
    userId: session.id,
    ip: clientIp(req.headers),
    entity: 'TwoFactorAuth',
    entityId: session.id,
    details: { email: session.email },
  });

  // 8. Return the plaintext backup codes (shown once)
  return ok({ backupCodes: plainCodes });
}
