import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const defaultTitle = value(form, 'defaultTitle');
    const defaultDescription = value(form, 'defaultDescription');

    if (defaultTitle.length < 2) return fail('Default SEO title is required.', 422);
    if (defaultDescription.length < 20) return fail('Default meta description must be at least 20 characters.', 422);

    const payload = {
      defaultTitle,
      defaultDescription,
      ogImage: value(form, 'ogImage'),
      keywords: value(form, 'keywords'),
      twitterHandle: value(form, 'twitterHandle').replace(/^@/, ''),
      robotsIndex: form.get('robotsIndex') === 'on',
      robotsFollow: form.get('robotsFollow') === 'on',
    };

    await prisma.setting.upsert({
      where: { key: 'seo' },
      update: { value: toJson(payload) },
      create: { key: 'seo', value: toJson(payload) },
    });
    await audit({ actorId: admin.id, action: 'seo.update', entity: 'Setting', entityId: 'seo', metadata: payload });

    return NextResponse.redirect(new URL('/admin/seo?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'SEO settings update failed.', 500);
  }
}
