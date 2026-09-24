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

    await prisma.skillProfile.upsert({
      where: { userId_skill: { userId: user.id, skill: String(f.get('skill')) } },
      update: { level: String(f.get('level')), source: String(f.get('source') || '') },
      create: {
        userId: user.id,
        skill: String(f.get('skill')),
        level: String(f.get('level')),
        source: String(f.get('source') || '')
      }
    });

    return NextResponse.redirect(new URL('/student/skills', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
