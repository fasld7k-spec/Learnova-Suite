import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { verifyCsrf } from '@/lib/csrf';

function dueDate(value: FormDataEntryValue | null) {
  const raw = String(value || '');
  return raw ? new Date(raw) : null;
}

async function ownedLessonForCourse(lessonId: string, courseId: string, instructorId: string) {
  if (!lessonId) return null;
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: { course: { id: courseId, instructorId } }
    },
    select: { id: true }
  });
  if (!lesson) throw new Error('Lesson not found');
  return lesson.id;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(f.get('action') || 'create');

    if (action === 'delete') {
      const assignmentId = String(f.get('assignmentId') || '');
      const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, courseId: { in: (await prisma.course.findMany({ where: { instructorId: user.id }, select: { id: true } })).map((course) => course.id) } } });
      if (!assignment) return fail('Assignment not found', 404);
      await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: assignment.id } });
      await prisma.assignment.delete({ where: { id: assignment.id } });
      return NextResponse.redirect(new URL('/instructor/assignments', req.url), 303);
    }

    const course = await prisma.course.findFirst({ where: { id: String(f.get('courseId')), instructorId: user.id } });
    if (!course) return fail('Course not found', 404);
    const data = {
      courseId: course.id,
      lessonId: await ownedLessonForCourse(String(f.get('lessonId') || ''), course.id, user.id),
      title: String(f.get('title') || '').trim(),
      description: String(f.get('description') || '').trim(),
      dueAt: dueDate(f.get('dueAt'))
    };
    if (!data.title || !data.description) return fail('Title and instructions are required.', 422);

    if (action === 'update') {
      const assignmentId = String(f.get('assignmentId') || '');
      const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, courseId: course.id } });
      if (!assignment) return fail('Assignment not found', 404);
      await prisma.assignment.update({ where: { id: assignment.id }, data });
      return NextResponse.redirect(new URL('/instructor/assignments', req.url), 303);
    }

    await prisma.assignment.create({ data });
    return NextResponse.redirect(new URL('/instructor/assignments', req.url), 303);
  } catch (e: any) {
    return fail(e.message, e.message === 'Lesson not found' ? 404 : 500);
  }
}
