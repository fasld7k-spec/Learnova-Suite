import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.waitlist', 15, 10 * 60_000);
  if (limited) return limited;

  const f = await req.formData();
  const email = String(f.get('email'));
  const courseId = String(f.get('courseId'));
  if (!email.includes('@')) return fail('Invalid email', 422);
  await prisma.courseWaitlist.upsert({
    where: { courseId_email: { courseId, email } },
    update: {},
    create: { courseId, email },
  });
  return ok({ message: 'You joined the waitlist.' });
}
