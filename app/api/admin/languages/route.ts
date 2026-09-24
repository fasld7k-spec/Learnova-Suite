import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { languagePresets } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { invalidateSiteSettingsCache } from '@/lib/cache';
import { verifyCsrf } from '@/lib/csrf';

async function syncGeneralLanguage(code: string, direction: string) {
  const row = await prisma.setting.findUnique({ where: { key: 'general' } });
  const current = fromJsonObject<Record<string, unknown>>(row?.value);
  const value = toJson({
    ...current,
    defaultLanguage: code,
    rtl: direction === 'rtl'
  });

  await prisma.setting.upsert({
    where: { key: 'general' },
    update: { value },
    create: { key: 'general', value }
  });
}

async function activateOnly(code: string) {
  const language = await prisma.language.findUnique({ where: { code } });
  if (!language) return null;

  await prisma.$transaction([
    prisma.language.updateMany({ data: { active: false } }),
    prisma.language.update({ where: { code }, data: { active: true } })
  ]);
  await syncGeneralLanguage(language.code, language.direction);
  await invalidateSiteSettingsCache();
  return language;
}

async function syncLanguagePresets() {
  const active = await prisma.language.findFirst({ where: { active: true }, orderBy: { code: 'asc' } });
  const activeCode = active?.code || 'en';

  for (const language of languagePresets) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: {
        name: language.nativeName,
        direction: language.direction,
        active: language.code === activeCode
      },
      create: {
        code: language.code,
        name: language.nativeName,
        direction: language.direction,
        active: language.code === activeCode
      }
    });
  }

  const finalActive = await prisma.language.findFirst({ where: { active: true }, orderBy: { code: 'asc' } });
  if (finalActive) await syncGeneralLanguage(finalActive.code, finalActive.direction);
  await invalidateSiteSettingsCache();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const mode = String(form.get('mode') || 'save');

    if (mode === 'sync-presets') {
      await syncLanguagePresets();
      await audit({
        actorId: admin.id,
        action: 'language.syncPresets',
        entity: 'language',
        entityId: 'built-in-presets',
        metadata: { count: languagePresets.length },
      });
      return NextResponse.redirect(new URL('/admin/languages', req.url), 303);
    }

    if (mode === 'activate') {
      const activeLanguageCode = String(form.get('activeLanguageCode') || '').trim().toLowerCase();
      if (!activeLanguageCode) return fail('Active language is required', 422);
      const activated = await activateOnly(activeLanguageCode);
      if (!activated) return fail('Language not found', 404);
      await audit({
        actorId: admin.id,
        action: 'language.activate',
        entity: 'language',
        entityId: activated.code,
        metadata: { direction: activated.direction, name: activated.name },
      });
      return NextResponse.redirect(new URL('/admin/languages', req.url), 303);
    }

    if (mode === 'delete') {
      const code = String(form.get('code') || '').trim().toLowerCase();
      if (!code) return fail('Language code is required', 422);
      const language = await prisma.language.findUnique({ where: { code } });
      if (!language) return fail('Language not found', 404);
      if (language.active) return fail('Activate another language before deleting the current site language.', 409);
      await prisma.language.delete({ where: { code } });
      await invalidateSiteSettingsCache();
      await audit({
        actorId: admin.id,
        action: 'language.delete',
        entity: 'language',
        entityId: code,
        metadata: { name: language.name, direction: language.direction },
      });
      return NextResponse.redirect(new URL('/admin/languages', req.url), 303);
    }

    const code = String(form.get('code') || '').trim().toLowerCase();
    const name = String(form.get('name') || '').trim();
    const direction = String(form.get('direction') || 'ltr') === 'rtl' ? 'rtl' : 'ltr';
    const makeActive = form.get('makeActive') === 'on';

    if (!code || !name) return fail('Language code and name are required', 422);
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(code)) return fail('Language code must look like en, ar, fr, or pt-br.', 422);

    const existing = await prisma.language.findUnique({ where: { code } });
    await prisma.language.upsert({
      where: { code },
      update: { name, direction, active: makeActive ? true : existing?.active ?? false },
      create: { code, name, direction, active: makeActive },
    });

    if (makeActive) {
      await activateOnly(code);
    } else {
      await invalidateSiteSettingsCache();
    }
    await audit({
      actorId: admin.id,
      action: existing ? 'language.update' : 'language.create',
      entity: 'language',
      entityId: code,
      metadata: { name, direction, active: makeActive || existing?.active || false },
    });

    return NextResponse.redirect(new URL('/admin/languages', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
