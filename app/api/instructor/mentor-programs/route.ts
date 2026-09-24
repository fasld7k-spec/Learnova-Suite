import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create');

    if (action === 'delete') {
      const program = await prisma.mentorProgram.findFirst({
        where: { id: String(form.get('programId') || ''), instructorId: user.id },
        select: { id: true }
      });
      if (!program) return fail('Program not found', 404);
      await prisma.mentorEnrollment.deleteMany({ where: { programId: program.id } });
      await prisma.mentorProgram.delete({ where: { id: program.id } });
      return NextResponse.redirect(new URL('/instructor/mentor-programs', req.url), 303);
    }

    if (action === 'toggle') {
      const program = await prisma.mentorProgram.findFirst({
        where: { id: String(form.get('programId') || ''), instructorId: user.id },
        select: { id: true, active: true }
      });
      if (!program) return fail('Program not found', 404);
      await prisma.mentorProgram.update({
        where: { id: program.id },
        data: { active: form.has('active') ? form.get('active') === 'true' : !program.active }
      });
      return NextResponse.redirect(new URL('/instructor/mentor-programs', req.url), 303);
    }

    if (action === 'update') {
      const program = await prisma.mentorProgram.findFirst({
        where: { id: String(form.get('programId') || ''), instructorId: user.id },
        select: { id: true }
      });
      if (!program) return fail('Program not found', 404);
      await prisma.mentorProgram.update({
        where: { id: program.id },
        data: {
          title: String(form.get('title') || '').trim(),
          description: String(form.get('description') || '').trim(),
          price: Number(form.get('price') || 0),
          active: form.get('active') === 'on'
        }
      });
      return NextResponse.redirect(new URL('/instructor/mentor-programs', req.url), 303);
    }

    await prisma.mentorProgram.create({
      data: {
        instructorId: user.id,
        title: String(form.get('title') || '').trim(),
        description: String(form.get('description') || '').trim(),
        price: Number(form.get('price') || 0),
        active: form.get('active') === 'on'
      }
    });
    return NextResponse.redirect(new URL('/instructor/mentor-programs', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
