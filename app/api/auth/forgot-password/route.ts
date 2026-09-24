import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail } from '@/lib/api';
import { renderEmailTemplate, sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { createPasswordResetToken } from '@/lib/auth';
import { appUrlFromRequest } from '@/lib/app-url';

function requestIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

function canExposeDemoResetToken() {
  return process.env.NODE_ENV !== 'production' &&
    process.env.DEMO_MODE === 'true' &&
    process.env.EMAIL_PROVIDER === 'demo';
}

function isValidEmail(email: string) {
  return email.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const ip = requestIp(req);
  const limited = rateLimit(`auth.forgot:${ip}`, 5, 60_000);
  if (!limited.ok) return fail('Too many recovery attempts. Try again in a minute.', 429);

  const f = await req.formData().catch(() => new FormData());
  const email = String(f.get('email') || '').trim().toLowerCase();
  const user = isValidEmail(email) ? await prisma.user.findUnique({ where: { email } }) : null;

  let resetToken = '';
  if (user) {
    const appUrl = appUrlFromRequest(req);
    resetToken = await createPasswordResetToken({ id: user.id, email: user.email, passwordHash: user.passwordHash });
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const emailContent = await renderEmailTemplate('password-reset', {
      name: user.name,
      resetUrl,
      expiresIn: '30 minutes'
    }).catch(() => ({
      subject: 'Password reset',
      html: `<h1>Password reset</h1><p>Use this password reset link within 30 minutes: <a href="${resetUrl}">${resetUrl}</a></p>`
    }));
    await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html
    });
  }

  const acceptsHtml = req.headers.get('accept')?.includes('text/html');
  if (acceptsHtml) {
    const url = new URL('/forgot-password', req.url);
    url.searchParams.set('status', 'sent');
    if (canExposeDemoResetToken() && resetToken) url.searchParams.set('demoToken', resetToken);
    return NextResponse.redirect(url, 303);
  }

  return ok({ message: 'If the email exists, reset instructions were sent.' });
}
