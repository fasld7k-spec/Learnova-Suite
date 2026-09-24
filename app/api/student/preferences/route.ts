import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {
        email: f.get('email') === 'on',
        inApp: f.get('inApp') === 'on',
        marketing: f.get('marketing') === 'on',
        liveReminders: f.get('liveReminders') === 'on'
      },
      create: {
        userId: user.id,
        email: f.get('email') === 'on',
        inApp: f.get('inApp') === 'on',
        marketing: f.get('marketing') === 'on',
        liveReminders: f.get('liveReminders') === 'on'
      }
    });

    return NextResponse.redirect(new URL('/student/preferences', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
