import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { toList } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/slug';
import { verifyCsrf } from '@/lib/csrf';

function field(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function selectedCourses(form: FormData) {
  return Array.from(new Set(form.getAll('courseIds').map(String).filter(Boolean)));
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = field(form, 'action') || 'save';
    const id = field(form, 'id');
    const redirectUrl = new URL('/admin/bundles', req.url);

    if (action === 'delete') {
      if (!id) return fail('Bundle ID is required.', 422);
      const bundle = await prisma.courseBundle.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'bundle.delete', entity: 'CourseBundle', entityId: bundle.id, metadata: { slug: bundle.slug, title: bundle.title } });
      return NextResponse.redirect(redirectUrl, 303);
    }

    if (action === 'toggle') {
      if (!id) return fail('Bundle ID is required.', 422);
      const bundle = await prisma.courseBundle.update({ where: { id }, data: { active: field(form, 'active') === 'true' } });
      await audit({ actorId: admin.id, action: bundle.active ? 'bundle.enable' : 'bundle.disable', entity: 'CourseBundle', entityId: bundle.id, metadata: { slug: bundle.slug } });
      return NextResponse.redirect(redirectUrl, 303);
    }

    const title = field(form, 'title');
    const slug = field(form, 'slug') || slugify(title);
    const price = Number(field(form, 'price') || 0);
    const courseIds = selectedCourses(form);
    if (title.length < 3) return fail('Bundle title is required.', 422);
    if (slug.length < 3) return fail('Bundle slug is required.', 422);
    if (!Number.isFinite(price) || price < 0) return fail('Bundle price must be zero or greater.', 422);
    if (courseIds.length < 2) return fail('A bundle must include at least two courses.', 422);

    const publishedCount = await prisma.course.count({ where: { id: { in: courseIds }, status: 'PUBLISHED' } });
    if (publishedCount !== courseIds.length) return fail('All bundle courses must be published.', 422);

    const data = {
      title,
      slug,
      description: field(form, 'description'),
      price,
      courseIds: toList(courseIds),
      active: form.get('active') === 'on',
    };

    const bundle = id
      ? await prisma.courseBundle.update({ where: { id }, data })
      : await prisma.courseBundle.upsert({ where: { slug }, update: data, create: data });
    await audit({ actorId: admin.id, action: id ? 'bundle.update' : 'bundle.save', entity: 'CourseBundle', entityId: bundle.id, metadata: { slug: bundle.slug, title: bundle.title, courseCount: courseIds.length } });
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error: any) {
    return fail(error.message, /required|published|price|course|slug|ID/i.test(error.message) ? 422 : 500);
  }
}
