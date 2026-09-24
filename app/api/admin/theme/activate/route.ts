import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { invalidateSiteSettingsCache } from '@/lib/cache';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { isHomeThemeId } from '@/lib/home-theme-registry';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const homeTheme = form.get('homeTheme');
    if (!isHomeThemeId(homeTheme)) throw new Error('Invalid theme.');

    const row = await prisma.setting.findUnique({ where: { key: 'theme' } });
    const current = fromJsonObject<any>(row?.value);
    const value = toJson({
      ...current,
      homeTheme
    });

    await prisma.setting.upsert({ where: { key: 'theme' }, update: { value }, create: { key: 'theme', value } });
    await invalidateSiteSettingsCache();
    await audit({
      actorId: admin.id,
      action: 'theme.activate',
      entity: 'setting',
      entityId: 'theme',
      metadata: { homeTheme },
    });
    return NextResponse.redirect(new URL('/admin/theme?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Unable to activate theme.', 500);
  }
}
