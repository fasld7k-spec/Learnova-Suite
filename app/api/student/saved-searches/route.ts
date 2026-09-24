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
    const filters = {
      category: String(form.get('category') || ''),
      level: String(form.get('level') || ''),
      price: String(form.get('price') || ''),
    };
    await prisma.savedSearch.create({
      data: {
        userId: user.id,
        query: String(form.get('query')),
        filters: toJson(filters),
      },
    });
    return NextResponse.redirect(new URL('/student/saved-searches', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
