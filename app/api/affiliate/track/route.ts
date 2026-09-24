import { NextRequest, NextResponse } from 'next/server';
import { fail, ok } from '@/lib/api';
import { getAffiliateAddon, normalizeAffiliateCode } from '@/lib/affiliate';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.affiliate-track', 60, 10 * 60_000);
  if (limited) return limited;

  const addon = await getAffiliateAddon();
  if (!addon.active) return ok({ tracked: false, reason: 'affiliate add-on disabled' });

  const body = await req.json().catch(() => ({}));
  const code = normalizeAffiliateCode(body.ref);
  if (!code) return fail('Referral code is required.', 422);

  const link = await prisma.affiliateLink.findUnique({ where: { code } });
  if (!link) return ok({ tracked: false });

  await prisma.affiliateLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } });
  const response = NextResponse.json({ success: true, tracked: true });
  response.cookies.set('affiliate_ref', link.code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: addon.cookieDays * 24 * 60 * 60,
  });
  return response;
}
