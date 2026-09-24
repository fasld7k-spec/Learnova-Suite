import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createEmailVerificationToken, hashPassword, requireUser, verifyPassword } from '@/lib/auth';
import { fail, handleError, ok } from '@/lib/api';
import { sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import { getSiteSettings } from '@/lib/site-settings';
import { invalidateUserProfileCache } from '@/lib/cache';
import { logAuditEvent } from '@/lib/audit-log';
import { appUrlFromRequest } from '@/lib/app-url';
import { verifyCsrf } from '@/lib/csrf';

function requestIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || '');
    const acceptsHtml = req.headers.get('accept')?.includes('text/html');

    if (action === 'send-verification') {
      const limited = rateLimit(`account.verify:${user.id}:${requestIp(req)}`, 4, 60_000);
      if (!limited.ok) return fail('Too many verification emails. Try again in a minute.', 429);

      const settings = await getSiteSettings();
      const appUrl = appUrlFromRequest(req, settings.publicAppUrl);
      const token = await createEmailVerificationToken({ id: user.id, email: user.email });
      const verifyUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: user.email,
        subject: `Verify your ${settings.siteName} email`,
        html: `<h1>Verify your email</h1><p>Use this verification link within 24 hours: <a href="${verifyUrl}">${verifyUrl}</a></p>`
      });

      if (acceptsHtml) return NextResponse.redirect(new URL('/account?verification=sent', req.url), 303);
      return ok({ message: 'Verification email queued.' });
    }

    if (action === 'change-password') {
      const limited = rateLimit(`account.password:${user.id}:${requestIp(req)}`, 5, 15 * 60_000);
      if (!limited.ok) return fail('Too many password change attempts. Try again later.', 429);

      const currentPassword = String(form.get('currentPassword') || '');
      const password = String(form.get('password') || '');
      const confirmPassword = String(form.get('confirmPassword') || '');
      const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);

      if (!isCurrentValid || password.length < 8 || password !== confirmPassword) {
        if (acceptsHtml) return NextResponse.redirect(new URL('/account?password=invalid', req.url), 303);
        return fail('Current password is incorrect, or the new password is invalid.', 422);
      }

      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() } });
      await invalidateUserProfileCache(user.id);
      void logAuditEvent({
        action: 'auth.password_change',
        userId: user.id,
        ip: requestIp(req),
        entity: 'User',
        entityId: user.id,
        details: { email: user.email },
      });
      if (acceptsHtml) return NextResponse.redirect(new URL('/account?password=changed', req.url), 303);
      return ok({ message: 'Password changed.' });
    }

    return fail('Unsupported account action.', 400);
  } catch (error) {
    return handleError(error);
  }
}
