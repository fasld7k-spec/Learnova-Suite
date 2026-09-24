import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/prerequisites', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function assertCourses(courseId: string, prerequisiteCourseId: string) {
  if (!courseId || !prerequisiteCourseId) throw new Error('Course and prerequisite course are required.');
  if (courseId === prerequisiteCourseId) throw new Error('A course cannot require itself.');
  const count = await prisma.course.count({ where: { id: { in: [courseId, prerequisiteCourseId] } } });
  if (count !== 2) throw new Error('Course or prerequisite was not found.');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Prerequisite id is required.', 422);
      await prisma.coursePrerequisite.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'course_prerequisite.delete', entity: 'CoursePrerequisite', entityId: id });
      return redirect(req);
    }

    const courseId = value(form, 'courseId');
    const prerequisiteCourseId = value(form, 'prerequisiteCourseId');
    await assertCourses(courseId, prerequisiteCourseId);

    const duplicate = await prisma.coursePrerequisite.findFirst({
      where: { courseId, prerequisiteCourseId, ...(id ? { id: { not: id } } : {}) },
    });
    if (duplicate) return fail('This prerequisite already exists.', 409);

    if (action === 'update') {
      if (!id) return fail('Prerequisite id is required.', 422);
      await prisma.coursePrerequisite.update({ where: { id }, data: { courseId, prerequisiteCourseId } });
      await audit({ actorId: admin.id, action: 'course_prerequisite.update', entity: 'CoursePrerequisite', entityId: id });
      return redirect(req);
    }

    const row = await prisma.coursePrerequisite.create({ data: { courseId, prerequisiteCourseId } });
    await audit({ actorId: admin.id, action: 'course_prerequisite.create', entity: 'CoursePrerequisite', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Course prerequisite update failed.', 500);
  }
}
