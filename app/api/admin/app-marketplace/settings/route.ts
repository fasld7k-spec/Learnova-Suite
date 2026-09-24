import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { addonSettingsSchema } from '@/lib/addons';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret } from '@/lib/secret-fields';
import { validateStoredUrl } from '@/lib/url-validation';

function formValue(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(formValue(form, 'csrfToken')))) return fail('Invalid CSRF token.', 403);
    const appId = formValue(form, 'appId');
    if (!appId) return fail('App ID is required.', 422);

    const app = await prisma.marketplaceApp.findUnique({ where: { id: appId } });
    if (!app) return fail('Addon was not found.', 404);

    const existing = await prisma.appInstallation.findFirst({ where: { appId, tenantId: null, userId: null } });
    const current = fromJsonObject(existing?.config);
    const settings: Record<string, unknown> = { ...current };

    for (const field of addonSettingsSchema(app.config)) {
      if (field.type === 'boolean') {
        settings[field.key] = form.get(field.key) === 'on';
        continue;
      }

      const raw = formValue(form, field.key);
      if (field.secret) {
        const existingSecret = decryptSecret(settings[field.key]);
        if (field.required && !raw && !existingSecret) throw new Error(`${field.label} is required.`);
        if (raw) settings[field.key] = encryptSecret(raw);
      } else if (field.type === 'number') {
        const number = raw ? Number(raw) : Number(field.defaultValue || 0);
        if (field.required && !raw && field.defaultValue === undefined) throw new Error(`${field.label} is required.`);
        if (!Number.isFinite(number)) throw new Error(`${field.label} must be a valid number.`);
        settings[field.key] = number;
      } else if (field.type === 'url') {
        if (field.required && !raw) throw new Error(`${field.label} is required.`);
        settings[field.key] = validateStoredUrl(raw || String(field.defaultValue || ''), { label: field.label, allowRelative: false });
      } else if (field.type === 'select') {
        const selected = raw || String(field.defaultValue || '');
        if (field.required && !selected) throw new Error(`${field.label} is required.`);
        if (selected && field.options.length && !field.options.includes(selected)) throw new Error(`${field.label} has an unsupported value.`);
        settings[field.key] = selected;
      } else {
        if (field.required && !raw && field.defaultValue === undefined) throw new Error(`${field.label} is required.`);
        settings[field.key] = raw || field.defaultValue || '';
      }
    }

    if (existing) {
      await prisma.appInstallation.update({ where: { id: existing.id }, data: { config: toJson(settings), active: true } });
    } else {
      await prisma.appInstallation.create({ data: { appId, config: toJson(settings), active: true } });
    }
    await prisma.marketplaceApp.update({ where: { id: appId }, data: { installed: true } });
    await audit({
      actorId: admin.id,
      action: 'addon.settings.update',
      entity: 'marketplaceApp',
      entityId: app.id,
      metadata: {
        slug: app.slug,
        name: app.name,
        configuredFields: addonSettingsSchema(app.config).map((field) => ({ key: field.key, secret: field.secret })),
      },
    });

    return NextResponse.redirect(new URL('/admin/app-marketplace', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
