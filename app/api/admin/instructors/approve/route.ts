import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    if (!id) return fail('Instructor id is required.', 422);

    const instructor = await prisma.user.update({
      where: { id },
      data: { status: 'APPROVED' },
      select: { id: true, name: true, email: true },
    });
    await audit({
      actorId: admin.id,
      action: 'instructor.approve',
      entity: 'user',
      entityId: instructor.id,
      metadata: { email: instructor.email, name: instructor.name },
    });

    return NextResponse.redirect(new URL('/admin/instructors', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
