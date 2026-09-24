/**
 * POST /api/auth/2fa/setup
 *
 * Authenticated endpoint that generates a new TOTP secret for the current user,
 * stores it (encrypted) in the TwoFactorAuth table with enabled: false,
 * and returns a QR code URL for use with authenticator apps.
 *
 * Requirements: 8.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { generateTOTPSecret, encryptSecret } from '@/lib/2fa';
import { prisma } from '@/lib/prisma';
import { fail, handleError } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const csrfToken = req.headers.get('x-csrf-token') || String(body.csrfToken || '');
    if (!(await verifyCsrf(csrfToken))) return fail('Invalid CSRF token.', 403);

    // Generate a new TOTP secret (base32-encoded)
    const plainSecret = generateTOTPSecret();

    // Encrypt the secret before storing it at rest
    const encryptedSecret = encryptSecret(plainSecret);

    // Upsert into TwoFactorAuth — create if not exists, update if already exists
    await prisma.twoFactorAuth.upsert({
      where: { userId: user.id },
      update: {
        secret: encryptedSecret,
        enabled: false,
      },
      create: {
        userId: user.id,
        secret: encryptedSecret,
        backupCodes: JSON.stringify([]),
        enabled: false,
      },
    });

    // Build the otpauth:// URL for QR code generation
    const issuer = process.env.TOTP_ISSUER ?? 'Learnova Suite';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}?secret=${plainSecret}&issuer=${encodeURIComponent(issuer)}`;

    return NextResponse.json({ success: true, data: { otpauthUrl } }, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED') return fail('Unauthenticated', 401);
    return handleError(e);
  }
}
