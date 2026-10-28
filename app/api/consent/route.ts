import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';
import { clientIp } from '@/lib/client-ip';

function requestIp(req: NextRequest) {
  const ip = clientIp(req.headers);
  return ip === 'local' ? null : ip;
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
