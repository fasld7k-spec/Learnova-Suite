import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/pages', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Page id is required.', 422);
      await prisma.page.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'page.delete', entity: 'Page', entityId: id });
      return redirect(req);
    }

    const slug = slugify(value(form, 'slug'));
    const titleEn = value(form, 'titleEn');
    const titleAr = value(form, 'titleAr');
    const bodyEn = value(form, 'bodyEn');
    const bodyAr = value(form, 'bodyAr');
    const seoTitle = value(form, 'seoTitle') || null;
    const seoDescription = value(form, 'seoDescription') || null;
    if (slug.length < 2) return fail('Page slug is required.', 422);
    if (titleEn.length < 2 || titleAr.length < 2) return fail('Page titles are required.', 422);
    if (bodyEn.length < 10 || bodyAr.length < 10) return fail('Page bodies are required.', 422);

    const data = { slug, titleEn, titleAr, bodyEn, bodyAr, seoTitle, seoDescription };
    if (action === 'update') {
      if (!id) return fail('Page id is required.', 422);
      await prisma.page.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'page.update', entity: 'Page', entityId: id });
      return redirect(req);
    }

    const page = await prisma.page.upsert({ where: { slug }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'page.upsert', entity: 'Page', entityId: page.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Page update failed.', 500);
  }
}
