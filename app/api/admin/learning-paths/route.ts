import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { toList } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/learning-paths', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function validCourseIds(ids: string[]) {
  if (!ids.length) return [];
  const courses = await prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return courses.map((course) => course.id);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Learning path id is required.', 422);
      await prisma.learningPathEnrollment.deleteMany({ where: { learningPathId: id } });
      await prisma.learningPath.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'learning_path.delete', entity: 'LearningPath', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Learning path id is required.', 422);
      const current = await prisma.learningPath.findUnique({ where: { id } });
      if (!current) return fail('Learning path not found.', 404);
      await prisma.learningPath.update({ where: { id }, data: { active: !current.active } });
      return redirect(req);
    }

    const title = value(form, 'title');
    const slug = slugify(value(form, 'slug') || title);
    const description = value(form, 'description');
    const selectedCourseIds = await validCourseIds(form.getAll('courseIds').map(String));
    if (title.length < 2) return fail('Learning path title is required.', 422);
    if (slug.length < 2) return fail('Learning path slug is required.', 422);
    if (description.length < 5) return fail('Learning path description is required.', 422);

    const data = {
      title,
      slug,
      description,
      courseIds: toList(selectedCourseIds),
      active: form.get('active') === 'on',
    };

    if (action === 'update') {
      if (!id) return fail('Learning path id is required.', 422);
      await prisma.learningPath.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'learning_path.update', entity: 'LearningPath', entityId: id });
      return redirect(req);
    }

    const row = await prisma.learningPath.upsert({ where: { slug }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'learning_path.upsert', entity: 'LearningPath', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Learning path update failed.', 500);
  }
}
