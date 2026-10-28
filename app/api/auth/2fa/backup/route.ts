import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authCookieName, clearCookieOptions, createToken, secureCookieOptions, passwordFingerprint, twoFactorChallengeCookieName, verifyTwoFactorChallengeToken, type Role } from '@/lib/auth';
import { verifyBackupCode } from '@/lib/2fa';
import { fail } from '@/lib/api';
import { enforceRateLimit } from '@/lib/request-security';

/**
 * POST /api/auth/2fa/backup
 *
 * Continuation endpoint used during a password-verified 2FA login challenge.
 * Accepts a userId plus a plaintext backup code, verifies it against the
 * stored bcrypt hashes, consumes the matched code, and issues a JWT session
 * cookie on success.
 *
 * Requirements: 8.7, 8.8
 */
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'auth.2fa.backup', 5, 10 * 60_000);
  if (limited) return limited;

  let body: { userId?: unknown; backupCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body', 400);
  }

  const { userId, backupCode } = body;

  if (typeof userId !== 'string' || !userId.trim()) {
    return fail('userId is required', 400);
  }
  const userLimited = enforceRateLimit(req, `auth.2fa.backup.user:${userId}`, 5, 30 * 60_000);
  if (userLimited) return userLimited;

  if (typeof backupCode !== 'string' || !backupCode.trim()) {
    return fail('backupCode is required', 400);
  }

  const challengeToken = req.cookies.get(twoFactorChallengeCookieName)?.value || '';
  let challenge: Awaited<ReturnType<typeof verifyTwoFactorChallengeToken>>;
  try {
    challenge = await verifyTwoFactorChallengeToken(challengeToken);
  } catch {
    return fail('Two-factor login challenge is required', 401);
  }
  if (challenge.id !== userId) return fail('Two-factor login challenge is invalid', 401);

  // Fetch the user and their TwoFactorAuth record together
  const twoFactor = await prisma.twoFactorAuth.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!twoFactor || !twoFactor.enabled) {
    return fail('Invalid backup code', 401);
  }
  if (['SUSPENDED', 'REJECTED'].includes(twoFactor.user.status)) {
    return fail('Account is not active', 403);
  }
  if (challenge.passwordFingerprint !== passwordFingerprint(twoFactor.user.passwordHash)) {
    return fail('Two-factor login challenge is stale', 401);
  }

  // Parse the stored backup code hashes
  let hashes: string[];
  try {
    hashes = JSON.parse(twoFactor.backupCodes);
    if (!Array.isArray(hashes)) throw new Error('Not an array');
  } catch {
    return fail('Invalid backup code', 401);
  }

  // Find the index of the matching (unconsumed) hash
  let matchIndex = -1;
  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i];
    // Skip already-consumed slots (null / empty string markers)
    if (!hash) continue;
    const matched = await verifyBackupCode(backupCode.trim(), hash);
    if (matched) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    return fail('Invalid backup code', 401);
  }

  // Consume the matched code by replacing it with null
  const updatedHashes = [...hashes];
  updatedHashes[matchIndex] = null as unknown as string;

  await prisma.twoFactorAuth.update({
    where: { userId },
    data: { backupCodes: JSON.stringify(updatedHashes) },
  });

  // Issue a JWT session cookie
  const user = twoFactor.user;
  const token = await createToken({ id: user.id, email: user.email, role: user.role as Role });

  const res = NextResponse.json({ success: true }, { status: 200 });
  res.cookies.set(authCookieName, token, secureCookieOptions());
  res.cookies.set(twoFactorChallengeCookieName, '', clearCookieOptions());

  return res;
}
