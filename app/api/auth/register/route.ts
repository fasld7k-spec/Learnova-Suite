import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authCookieName, createEmailVerificationToken, createToken, hashPassword, secureCookieOptions, type Role } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';
import { fail } from '@/lib/api';
import { dispatchEmail } from '@/lib/email';
import { getSiteSettings } from '@/lib/site-settings';
import { rateLimit } from '@/lib/rate-limit';
import { appUrlFromRequest } from '@/lib/app-url';
import { requestRedirectUrl } from '@/lib/redirect-url';
import { anyFeatureEnabled, featureEnabled } from '@/lib/features';
import { clientIp } from '@/lib/client-ip';

function requestIp(req: NextRequest) {
  return clientIp(req.headers);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(`auth.register:${requestIp(req)}`, 10, 15 * 60_000);
  if (!limited.ok) return fail('Too many registration attempts. Try again later.', 429);

  const settings = await getSiteSettings();
  if (!settings.registrationEnabled) return fail('Registration is disabled', 403);
  if (await featureEnabled('registration_closed')) return fail('Registration is temporarily closed.', 403);

  const data = Object.fromEntries((await req.formData()).entries());
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) return fail('Validation error', 422, parsed.error.flatten());
  if (parsed.data.role === 'INSTRUCTOR' && !settings.instructorsEnabled) return fail('Instructor registration is disabled', 403);
  if (parsed.data.role === 'INSTRUCTOR' && await anyFeatureEnabled(['instructor_registration_closed'])) {
    return fail('Instructor registration is temporarily closed.', 403);
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail('Email already exists', 409);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      status: parsed.data.role === 'INSTRUCTOR' ? 'PENDING' : 'APPROVED'
    }
  });

  const appUrl = appUrlFromRequest(req, settings.publicAppUrl);
  const verifyToken = await createEmailVerificationToken({ id: user.id, email: user.email });
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;

  void dispatchEmail({
    to: user.email,
    templateKey: 'welcome-email',
    variables: { name: user.name, siteName: settings.siteName, dashboardUrl: `${appUrl}/dashboard` },
    locale: user.locale
  });
  void dispatchEmail({
    to: user.email,
    templateKey: 'email-verification',
    variables: { name: user.name, verificationUrl: verifyUrl },
    locale: user.locale
  });

  const token = await createToken({ id: user.id, email: user.email, role: user.role as Role });
  const res = NextResponse.redirect(requestRedirectUrl(req, '/account?registered=1&verification=sent', settings.publicAppUrl), 303);
  res.cookies.set(authCookieName, token, secureCookieOptions());
  return res;
}
