import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/api';
import { hashPassword, passwordFingerprint, verifyPasswordResetToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

function requestIp(req: NextRequest) {
  return clientIp(req.headers);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(`auth.reset:${requestIp(req)}`, 5, 60_000);
  if (!limited.ok) return fail('Too many reset attempts. Try again in a minute.', 429);

  const form = await req.formData().catch(() => new FormData());
  const token = String(form.get('token') || '').trim();
  const password = String(form.get('password') || '');
  const confirmPassword = String(form.get('confirmPassword') || '');
  const acceptsHtml = req.headers.get('accept')?.includes('text/html');

  if (!token || token.length > 4096) {
    if (acceptsHtml) return NextResponse.redirect(new URL('/reset-password?status=invalid-token', req.url), 303);
    return fail('Reset link is invalid or expired.', 400);
  }

  if (password.length < 8 || password !== confirmPassword) {
    if (acceptsHtml) return NextResponse.redirect(new URL(`/reset-password?token=${encodeURIComponent(token)}&status=invalid-password`, req.url), 303);
    return fail('Password must be at least 8 characters and match confirmation.', 422);
  }

  try {
    const payload = await verifyPasswordResetToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.email !== payload.email || passwordFingerprint(user.passwordHash) !== payload.passwordFingerprint) throw new Error('INVALID_RESET_TOKEN');

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } });
    if (acceptsHtml) return NextResponse.redirect(new URL('/login?status=password-reset', req.url), 303);
    return ok({ message: 'Password updated.' });
  } catch {
    if (acceptsHtml) return NextResponse.redirect(new URL('/reset-password?status=invalid-token', req.url), 303);
    return fail('Reset link is invalid or expired.', 400);
  }
}
