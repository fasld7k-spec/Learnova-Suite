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
    const instructorId = String(form.get('instructorId') || '').trim();
    const note = String(form.get('note') || '').trim();

    if (!instructorId) return fail('Instructor ID is required.', 422);
    if (note.length < 3) return fail('Internal note must be at least 3 characters.', 422);

    const instructor = await prisma.user.findFirst({ where: { id: instructorId, role: 'INSTRUCTOR' }, select: { id: true } });
    if (!instructor) return fail('Instructor not found.', 404);

    const row = await prisma.instructorApplicationNote.create({
      data: { instructorId, adminId: admin.id, note },
    });
    await audit({
      actorId: admin.id,
      action: 'instructor.note.create',
      entity: 'instructorApplicationNote',
      entityId: row.id,
      metadata: { instructorId },
    });

    return NextResponse.redirect(new URL('/admin/instructors?note=added', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Instructor note could not be saved.', 500);
  }
}
