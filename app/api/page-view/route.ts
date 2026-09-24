import { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.page-view', 120, 10 * 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const session = await getSession();
  await prisma.pageView.create({
    data: {
      path: String(body.path || '/'),
      userId: session?.id,
      referrer: body.referrer || null,
    },
  }).catch(() => null);
  return ok({ tracked: true });
}
