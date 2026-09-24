import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.nps', 10, 10 * 60_000);
  if (limited) return limited;

  const f = await req.formData();
  if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
  const score = Number(f.get('score'));
  if (!Number.isInteger(score) || score < 0 || score > 10) return fail('Invalid score', 422);
  const session = await getSession();
  await prisma.npsResponse.create({
    data: {
      userId: session?.id,
      score,
      comment: String(f.get('comment') || ''),
    },
  });
  if (req.headers.get('accept')?.includes('application/json')) return ok({ message: 'Thanks' });
  return Response.redirect(new URL('/nps?submitted=1', req.url), 303);
}
