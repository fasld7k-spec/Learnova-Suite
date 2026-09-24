import { NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const pending = await prisma.dataExportRequest.findFirst({
      where: { userId: user.id, status: 'PENDING' },
      select: { id: true }
    });

    if (!pending) {
      await prisma.dataExportRequest.create({ data: { userId: user.id } });
    }

    return NextResponse.redirect(new URL('/student/privacy', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
