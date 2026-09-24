import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';
import { toList } from '@/lib/json-fields';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const courseIds = f.getAll('courseIds').map(String).filter(Boolean);

    await prisma.courseCollection.create({
      data: {
        userId: user.id,
        title: String(f.get('title')),
        courseIds: toList(courseIds)
      }
    });

    return NextResponse.redirect(new URL('/student/collections', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
