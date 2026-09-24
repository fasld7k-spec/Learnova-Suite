import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';
import { toJson } from '@/lib/json-fields';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const links = {
      website: String(form.get('website') || ''),
      linkedin: String(form.get('linkedin') || ''),
      github: String(form.get('github') || ''),
    };
    await prisma.resumeProfile.upsert({
      where: { userId: user.id },
      update: {
        headline: String(form.get('headline')),
        summary: String(form.get('summary')),
        links: toJson(links),
      },
      create: {
        userId: user.id,
        headline: String(form.get('headline')),
        summary: String(form.get('summary')),
        links: toJson(links),
      },
    });
    return NextResponse.redirect(new URL('/student/resume', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
