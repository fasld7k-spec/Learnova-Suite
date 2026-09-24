import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const levels = new Set(['beginner', 'intermediate', 'advanced']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/course-skills', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function assertCourse(courseId: string) {
  if (!courseId) throw new Error('Course is required.');
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new Error('Course not found.');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Skill id is required.', 422);
      await prisma.courseOutcomeSkill.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'course_skill.delete', entity: 'CourseOutcomeSkill', entityId: id });
      return redirect(req);
    }

    const courseId = value(form, 'courseId');
    const skill = value(form, 'skill');
    const level = value(form, 'level') || 'beginner';
    if (skill.length < 2) return fail('Skill is required.', 422);
    if (!levels.has(level)) return fail('Skill level is invalid.', 422);
    await assertCourse(courseId);

    if (action === 'update') {
      if (!id) return fail('Skill id is required.', 422);
      await prisma.courseOutcomeSkill.update({ where: { id }, data: { courseId, skill, level } });
      await audit({ actorId: admin.id, action: 'course_skill.update', entity: 'CourseOutcomeSkill', entityId: id });
      return redirect(req);
    }

    const row = await prisma.courseOutcomeSkill.create({ data: { courseId, skill, level } });
    await audit({ actorId: admin.id, action: 'course_skill.create', entity: 'CourseOutcomeSkill', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Course skill update failed.', 500);
  }
}
