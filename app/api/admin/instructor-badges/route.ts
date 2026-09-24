import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/instructor-badges', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function assertInstructor(instructorId: string) {
  if (!instructorId) throw new Error('Instructor is required.');
  const instructor = await prisma.user.findFirst({ where: { id: instructorId, role: 'INSTRUCTOR' }, select: { id: true } });
  if (!instructor) throw new Error('Instructor not found.');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Instructor badge id is required.', 422);
      await prisma.instructorBadge.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'instructor_badge.delete', entity: 'InstructorBadge', entityId: id });
      return redirect(req);
    }

    const instructorId = value(form, 'instructorId');
    const title = value(form, 'title');
    const icon = value(form, 'icon') || null;
    const reason = value(form, 'reason');
    if (title.length < 2) return fail('Badge title is required.', 422);
    if (reason.length < 2) return fail('Badge reason is required.', 422);
    await assertInstructor(instructorId);

    const data = { instructorId, title, icon, reason };
    if (action === 'update') {
      if (!id) return fail('Instructor badge id is required.', 422);
      await prisma.instructorBadge.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'instructor_badge.update', entity: 'InstructorBadge', entityId: id });
      return redirect(req);
    }

    const row = await prisma.instructorBadge.create({ data });
    await audit({ actorId: admin.id, action: 'instructor_badge.create', entity: 'InstructorBadge', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Instructor badge update failed.', 500);
  }
}
