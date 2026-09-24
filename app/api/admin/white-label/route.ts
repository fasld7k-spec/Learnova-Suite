import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { invalidateSiteSettingsCache } from '@/lib/cache';
import { toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { validateStoredUrl } from '@/lib/url-validation';
import { verifyCsrf } from '@/lib/csrf';

function field(form: FormData, key: string, fallback = '') {
  return String(form.get(key) || fallback).trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const brandName = field(form, 'brandName', 'Learnova Suite');
    const supportEmail = field(form, 'supportEmail', 'support@your-domain.com');

    if (brandName.length < 2) return fail('Brand name must be at least 2 characters.', 422);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) return fail('Support email must be valid.', 422);

    const value = toJson({
      brandName,
      logoUrl: validateStoredUrl(field(form, 'logoUrl'), { label: 'Logo URL', allowRelative: true }),
      faviconUrl: validateStoredUrl(field(form, 'faviconUrl'), { label: 'Favicon URL', allowRelative: true }),
      supportEmail,
      footerNote: field(form, 'footerNote'),
    });

    await prisma.setting.upsert({
      where: { key: 'white_label' },
      update: { value },
      create: { key: 'white_label', value },
    });
    await invalidateSiteSettingsCache();
    await audit({
      actorId: admin.id,
      action: 'white_label.update',
      entity: 'setting',
      entityId: 'white_label',
      metadata: { brandName, supportEmail },
    });

    return NextResponse.redirect(new URL('/admin/white-label?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'White-label settings could not be saved.', 500);
  }
}
