import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/product-updates', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Product update id is required.', 422);
      await prisma.productUpdate.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'product_update.delete', entity: 'ProductUpdate', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Product update id is required.', 422);
      const current = await prisma.productUpdate.findUnique({ where: { id } });
      if (!current) return fail('Product update not found.', 404);
      await prisma.productUpdate.update({ where: { id }, data: { published: !current.published } });
      return redirect(req);
    }

    const version = value(form, 'version');
    const title = value(form, 'title');
    const body = value(form, 'body');
    const published = form.get('published') === 'on';
    if (!/^\d+\.\d+\.\d+([-.][a-z0-9.]+)?$/i.test(version)) return fail('Version must look like 1.0.0.', 422);
    if (title.length < 2) return fail('Update title is required.', 422);
    if (body.length < 10) return fail('Update notes are required.', 422);

    const data = { version, title, body, published };
    if (action === 'update') {
      if (!id) return fail('Product update id is required.', 422);
      await prisma.productUpdate.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'product_update.update', entity: 'ProductUpdate', entityId: id });
      return redirect(req);
    }

    const row = await prisma.productUpdate.create({ data });
    await audit({ actorId: admin.id, action: 'product_update.create', entity: 'ProductUpdate', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Product update failed.', 500);
  }
}
