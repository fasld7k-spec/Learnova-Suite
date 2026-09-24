import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

function requestIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    null
  );
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.consent', 20, 10 * 60_000);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('Invalid consent request.', 422);
  const session = await getSession();
  const consentType = String((body as { type?: unknown }).type || 'cookies')
    .trim()
    .replace(/[^a-zA-Z0-9:_.-]/g, '_')
    .slice(0, 80) || 'cookies';
  await prisma.consentRecord.create({
    data: {
      userId: session?.id,
      type: consentType,
      granted: !!(body as { granted?: unknown }).granted,
      ip: requestIp(req),
    },
  });
  return ok({ saved: true });
}
