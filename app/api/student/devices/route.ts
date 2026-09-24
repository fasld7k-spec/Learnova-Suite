import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';

function deviceFingerprint(req: NextRequest, userId: string) {
  const userAgent = req.headers.get('user-agent') || 'unknown-agent';
  const language = req.headers.get('accept-language') || 'unknown-language';
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const realIp = req.headers.get('x-real-ip') || '';
  return createHash('sha256').update([userId, userAgent, language, forwardedFor || realIp].join('|')).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const name = String(form.get('name') || '').trim();
    if (!name) return fail('Device name is required.', 422);
    const token = deviceFingerprint(req, user.id);
    const existing = await prisma.userDevice.findFirst({ where: { userId: user.id, token }, select: { id: true } });

    if (existing) {
      await prisma.userDevice.update({ where: { id: existing.id }, data: { name, lastSeen: new Date() } });
    } else {
      await prisma.userDevice.create({
        data: {
          userId: user.id,
          name,
          token,
          lastSeen: new Date(),
        },
      });
    }
    return NextResponse.redirect(new URL('/student/devices', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
