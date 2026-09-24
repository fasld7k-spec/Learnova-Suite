import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateCourseCatalogCache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/categories', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Category id is required.', 422);
      const courseCount = await prisma.course.count({ where: { categoryId: id } });
      if (courseCount > 0) return fail('Categories with assigned courses cannot be deleted. Move courses first.', 409);
      await prisma.category.delete({ where: { id } });
      await invalidateCourseCatalogCache();
      await audit({ actorId: admin.id, action: 'category.delete', entity: 'Category', entityId: id });
      return redirect(req);
    }

    const nameEn = value(form, 'nameEn');
    const nameAr = value(form, 'nameAr');
    const slug = slugify(value(form, 'slug') || nameEn);
    if (nameEn.length < 2) return fail('English category name is required.', 422);
    if (nameAr.length < 2) return fail('Arabic category name is required.', 422);
    if (slug.length < 2) return fail('Category slug is required.', 422);

    const data = { nameEn, nameAr, slug };
    if (action === 'update') {
      if (!id) return fail('Category id is required.', 422);
      await prisma.category.update({ where: { id }, data });
      await invalidateCourseCatalogCache();
      await audit({ actorId: admin.id, action: 'category.update', entity: 'Category', entityId: id });
      return redirect(req);
    }

    const category = await prisma.category.create({ data });
    await invalidateCourseCatalogCache();
    await audit({ actorId: admin.id, action: 'category.create', entity: 'Category', entityId: category.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Category update failed.', 500);
  }
}
