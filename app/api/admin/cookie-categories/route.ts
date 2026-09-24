import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/cookie-categories', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizeKey(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Cookie category id is required.', 422);
      const current = await prisma.cookieCategory.findUnique({ where: { id } });
      if (!current) return fail('Cookie category not found.', 404);
      if (current.required) return fail('Required cookie categories cannot be deleted. Mark them optional first.', 409);
      await prisma.cookieCategory.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'cookie_category.delete', entity: 'CookieCategory', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Cookie category id is required.', 422);
      const current = await prisma.cookieCategory.findUnique({ where: { id } });
      if (!current) return fail('Cookie category not found.', 404);
      const updated = await prisma.cookieCategory.update({ where: { id }, data: { active: !current.active } });
      await audit({
        actorId: admin.id,
        action: updated.active ? 'cookie_category.enable' : 'cookie_category.disable',
        entity: 'CookieCategory',
        entityId: id,
      });
      return redirect(req);
    }

    const key = normalizeKey(value(form, 'key'));
    const name = value(form, 'name');
    const description = value(form, 'description');
    if (key.length < 2) return fail('Cookie category key is required.', 422);
    if (name.length < 2) return fail('Cookie category name is required.', 422);
    if (description.length < 5) return fail('Cookie category description is required.', 422);

    const data = {
      key,
      name,
      description,
      required: form.get('required') === 'on',
      active: form.get('active') === 'on',
    };

    if (action === 'update') {
      if (!id) return fail('Cookie category id is required.', 422);
      await prisma.cookieCategory.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'cookie_category.update', entity: 'CookieCategory', entityId: id });
      return redirect(req);
    }

    const row = await prisma.cookieCategory.upsert({ where: { key }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'cookie_category.upsert', entity: 'CookieCategory', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Cookie category update failed.', 500);
  }
}
