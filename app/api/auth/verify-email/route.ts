import { NextRequest, NextResponse } from 'next/server';
import { emailVerifiedCookieName, secureCookieOptions, verifyEmailVerificationToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';

  try {
    const payload = await verifyEmailVerificationToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.email !== payload.email) throw new Error('Invalid email verification token');

    const res = NextResponse.redirect(new URL('/account?verification=verified', req.url), 303);
    res.cookies.set(emailVerifiedCookieName, user.email, secureCookieOptions(60 * 60 * 24 * 365));
    return res;
  } catch {
    return NextResponse.redirect(new URL('/account?verification=invalid', req.url), 303);
  }
}
