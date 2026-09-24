import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/seo-redirects', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizePath(raw: string) {
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.replace(/\/{2,}/g, '/');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Redirect id is required.', 422);
      await prisma.seoRedirect.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'seo_redirect.delete', entity: 'SeoRedirect', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Redirect id is required.', 422);
      const current = await prisma.seoRedirect.findUnique({ where: { id } });
      if (!current) return fail('Redirect not found.', 404);
      await prisma.seoRedirect.update({ where: { id }, data: { active: !current.active } });
      return redirect(req);
    }

    const fromPath = normalizePath(value(form, 'fromPath'));
    const toPath = normalizePath(value(form, 'toPath'));
    const status = Number(value(form, 'status') || 301);
    const active = form.get('active') === 'on';
    if (fromPath === toPath) return fail('Redirect source and destination must be different.', 422);
    if (![301, 302, 307, 308].includes(status)) return fail('Redirect status must be 301, 302, 307, or 308.', 422);

    const data = { fromPath, toPath, status, active };
    if (action === 'update') {
      if (!id) return fail('Redirect id is required.', 422);
      await prisma.seoRedirect.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'seo_redirect.update', entity: 'SeoRedirect', entityId: id });
      return redirect(req);
    }

    const row = await prisma.seoRedirect.upsert({ where: { fromPath }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'seo_redirect.upsert', entity: 'SeoRedirect', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'SEO redirect update failed.', 500);
  }
}
