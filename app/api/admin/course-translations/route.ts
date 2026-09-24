import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/course-translations', req.url), 303);
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
      if (!id) return fail('Translation id is required.', 422);
      await prisma.courseTranslation.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'course_translation.delete', entity: 'CourseTranslation', entityId: id });
      return redirect(req);
    }

    const courseId = value(form, 'courseId');
    const locale = value(form, 'locale').toLowerCase();
    const title = value(form, 'title');
    const shortDescription = value(form, 'shortDescription');
    const fullDescription = value(form, 'fullDescription');
    await assertCourse(courseId);
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(locale)) return fail('Locale must be like ar, en, fr, or pt-br.', 422);
    if (title.length < 2) return fail('Translated title is required.', 422);
    if (shortDescription.length < 5) return fail('Short description is required.', 422);
    if (fullDescription.length < 10) return fail('Full description is required.', 422);

    const data = { courseId, locale, title, shortDescription, fullDescription };
    if (action === 'update') {
      if (!id) return fail('Translation id is required.', 422);
      await prisma.courseTranslation.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'course_translation.update', entity: 'CourseTranslation', entityId: id });
      return redirect(req);
    }

    const row = await prisma.courseTranslation.upsert({
      where: { courseId_locale: { courseId, locale } },
      update: data,
      create: data,
    });
    await audit({ actorId: admin.id, action: 'course_translation.upsert', entity: 'CourseTranslation', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Course translation update failed.', 500);
  }
}
