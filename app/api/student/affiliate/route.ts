import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { getAffiliateAddon } from '@/lib/affiliate';
import { verifyCsrf } from '@/lib/csrf';

const channels = new Set(['social', 'newsletter', 'cohort', 'partner']);

function codeFor(userId: string, channel: string) {
  const suffix = channels.has(channel) ? channel : 'social';
  return `AFF-${userId.slice(0, 6).toUpperCase()}-${suffix.toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const addon = await getAffiliateAddon();
    if (!addon.active) return fail('Affiliate Growth add-on is disabled.', 403);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const channel = String(form.get('channel') || 'social').toLowerCase();
    const code = codeFor(user.id, channel);

    await prisma.affiliateLink.upsert({
      where: { code },
      update: {},
      create: { userId: user.id, code }
    });

    return NextResponse.redirect(new URL('/student/affiliate', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
