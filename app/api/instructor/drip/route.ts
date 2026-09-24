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
      const schedule = await prisma.dripSchedule.findFirst({
        where: { id: String(form.get('scheduleId') || ''), lessonId: { in: await instructorLessonIds(user.id) } },
      });
      if (!schedule) return fail('Schedule not found', 404);
      await prisma.dripSchedule.delete({ where: { id: schedule.id } });
      return NextResponse.redirect(new URL('/instructor/drip', req.url), 303);
    }

    const lesson = await prisma.lesson.findFirst({
      where: { id: String(form.get('lessonId')), module: { course: { instructorId: user.id } } },
      include: { module: true }
    });
    if (!lesson) return fail('Lesson not found', 404);

    const unlockDay = Math.max(0, Number(form.get('unlockDay') || 0));
    const scheduleId = String(form.get('scheduleId') || '');

    if (action === 'update') {
      const schedule = await prisma.dripSchedule.findFirst({ where: { id: scheduleId, lessonId: { in: await instructorLessonIds(user.id) } } });
      if (!schedule) return fail('Schedule not found', 404);
      const duplicate = await prisma.dripSchedule.findFirst({ where: { lessonId: lesson.id, id: { not: schedule.id } } });
      if (duplicate) await prisma.dripSchedule.delete({ where: { id: duplicate.id } });
      await prisma.dripSchedule.update({ where: { id: schedule.id }, data: { courseId: lesson.module.courseId, lessonId: lesson.id, unlockDay } });
    } else {
      const existing = await prisma.dripSchedule.findFirst({ where: { lessonId: lesson.id } });
      if (existing) {
        await prisma.dripSchedule.update({ where: { id: existing.id }, data: { unlockDay, courseId: lesson.module.courseId } });
      } else {
        await prisma.dripSchedule.create({
          data: {
            courseId: lesson.module.courseId,
            lessonId: lesson.id,
            unlockDay
          }
        });
      }
    }
    return NextResponse.redirect(new URL('/instructor/drip', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}

async function instructorLessonIds(instructorId: string) {
  const lessons = await prisma.lesson.findMany({
    where: { module: { course: { instructorId } } },
    select: { id: true },
  });
  return lessons.map((lesson) => lesson.id);
}
