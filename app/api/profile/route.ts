import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { invalidateUserProfileCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: String(form.get('name') || '').trim(),
        bio: String(form.get('bio') || '').trim(),
        avatar: String(form.get('avatar') || '').trim(),
      },
    });
    await invalidateUserProfileCache(user.id);
    return NextResponse.redirect(new URL('/profile', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
