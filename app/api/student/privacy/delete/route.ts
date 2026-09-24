import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function cleanReason(value: FormDataEntryValue | null) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const pending = await prisma.dataDeletionRequest.findFirst({
      where: { userId: user.id, status: 'PENDING' },
      select: { id: true }
    });

    if (!pending) {
      await prisma.dataDeletionRequest.create({
        data: {
          userId: user.id,
          reason: cleanReason(form.get('reason'))
        }
      });
    }

    return NextResponse.redirect(new URL('/student/privacy', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
