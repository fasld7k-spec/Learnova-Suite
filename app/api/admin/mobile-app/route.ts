import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const allowedPlatforms = new Set(['ios', 'android', 'pwa']);
const allowedStatuses = new Set(['draft', 'review', 'ready', 'disabled']);

function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function setString(config: Record<string, unknown>, key: string, value: string) {
  if (value) config[key] = value;
  else delete config[key];
}

function validateUrl(value: string, label: string) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error(`${label} must be a valid http or https URL.`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = formText(form, '_action') || 'update';
    const platform = formText(form, 'platform');

    if (!platform) return fail('Platform is required', 422);
    if (!allowedPlatforms.has(platform)) return fail('Unsupported mobile platform.', 422);

    if (action === 'delete') {
      await prisma.mobileAppSetting.deleteMany({ where: { platform } });
      await audit({ actorId: admin.id, action: 'mobile_app.reset', entity: 'MobileAppSetting', entityId: platform });
      return NextResponse.redirect(new URL('/admin/mobile-app', req.url), 303);
    }

    const existing = await prisma.mobileAppSetting.findUnique({ where: { platform } });
    const existingConfig = fromJsonObject(existing?.config);
    const status = allowedStatuses.has(formText(form, 'status')) ? formText(form, 'status') : 'draft';
    const storeUrl = formText(form, 'storeUrl');
    const config: Record<string, unknown> = {
      ...existingConfig,
      status,
      deepLinks: form.get('deepLinks') === 'on',
    };

    validateUrl(storeUrl, 'Store URL');
    validateUrl(formText(form, 'universalLinks'), 'Universal links domain');

    setString(config, 'version', formText(form, 'version') || '1.0.0');
    setString(config, 'buildNumber', formText(form, 'buildNumber'));
    setString(config, 'minimumVersion', formText(form, 'minimumVersion'));
    setString(config, 'storeUrl', storeUrl);
    setString(config, 'bundleId', formText(form, 'bundleId'));
    setString(config, 'packageName', formText(form, 'packageName'));
    setString(config, 'appId', formText(form, 'appId'));
    setString(config, 'deepLinkScheme', formText(form, 'deepLinkScheme'));
    setString(config, 'universalLinks', formText(form, 'universalLinks'));
    setString(config, 'releaseNotes', formText(form, 'releaseNotes'));

    const row = await prisma.mobileAppSetting.upsert({
      where: { platform },
      update: { config: toJson(config), active: form.get('active') === 'on' },
      create: { platform, config: toJson(config), active: form.get('active') === 'on' },
    });

    await audit({ actorId: admin.id, action: 'mobile_app.update', entity: 'MobileAppSetting', entityId: row.id, metadata: { platform, status } });
    return NextResponse.redirect(new URL('/admin/mobile-app', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Mobile app setting update failed.', 500);
  }
}
