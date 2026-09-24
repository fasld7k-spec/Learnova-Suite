import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/seo-meta', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizePath(raw: string) {
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.replace(/\/{2,}/g, '/');
}

function validatePath(path: string) {
  if (!/^\/[a-zA-Z0-9/_?=&.#%-]*$/.test(path)) throw new Error('SEO path must be a valid internal path.');
  if (path.includes('..')) throw new Error('SEO path must not contain parent directory segments.');
  return path;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('SEO meta id is required.', 422);
      await prisma.seoMetaOverride.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'seo_meta.delete', entity: 'SeoMetaOverride', entityId: id });
      return redirect(req);
    }

    const path = validatePath(normalizePath(value(form, 'path')));
    const title = value(form, 'title');
    const description = value(form, 'description');
    const image = validateStoredUrl(value(form, 'image'), { label: 'OG image URL', allowRelative: true }) || null;
    if (path.length < 2) return fail('SEO path is required.', 422);
    if (title.length < 5) return fail('SEO title is required.', 422);
    if (description.length < 10) return fail('SEO description is required.', 422);

    const data = { path, title, description, image };
    if (action === 'update') {
      if (!id) return fail('SEO meta id is required.', 422);
      await prisma.seoMetaOverride.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'seo_meta.update', entity: 'SeoMetaOverride', entityId: id });
      return redirect(req);
    }

    const row = await prisma.seoMetaOverride.upsert({ where: { path }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'seo_meta.upsert', entity: 'SeoMetaOverride', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'SEO meta update failed.', 500);
  }
}
