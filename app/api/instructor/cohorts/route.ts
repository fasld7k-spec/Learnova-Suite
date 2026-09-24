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

    const course = await prisma.course.findFirst({ where: { id: String(form.get('courseId')), instructorId: user.id } });
    if (!course) return fail('Course not found', 404);

    await prisma.courseCohort.create({
      data: {
        courseId: course.id,
        title: String(form.get('title') || '').trim(),
        startsAt: new Date(String(form.get('startsAt'))),
        seats: Number(form.get('seats') || 0)
      }
    });
    return NextResponse.redirect(new URL('/instructor/cohorts', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
