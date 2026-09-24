import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/secret-fields';

const providerKeys: Record<string, string[]> = {
  google_analytics: ['trackingId', 'propertyId', 'measurementId'],
  facebook_pixel: ['trackingId', 'pixelId'],
  zapier: ['webhookUrl', 'webhookSecret'],
  mailchimp: ['audienceId', 'webhookUrl', 'webhookSecret', 'apiKey'],
  slack: ['channel', 'webhookUrl', 'webhookSecret'],
  zoom: ['accountId', 'clientId', 'userId', 'timezone', 'apiKey'],
  google_meet: ['clientId', 'calendarId', 'timezone', 'apiKey', 'clientSecret', 'refreshToken'],
};

const allowedModes = new Set(['test', 'live']);
const genericTrackingTarget: Record<string, string> = {
  mailchimp: 'audienceId',
  slack: 'channel',
  zoom: 'accountId',
  google_meet: 'calendarId',
};

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function setPlain(config: Record<string, unknown>, key: string, nextValue: string) {
  if (nextValue) config[key] = nextValue;
  else delete config[key];
}

function setEncrypted(config: Record<string, unknown>, key: string, nextValue: string, clear: boolean) {
  if (clear) {
    delete config[key];
    return;
  }
  if (nextValue) config[key] = encryptSecret(nextValue);
}

function providerSecretKeys(provider: string) {
  if (provider === 'zoom') return ['clientSecret', 'apiKey', 'secretKey'];
  if (provider === 'google_meet') return ['accessToken', 'apiKey', 'secretKey'];
  return ['apiKey', 'secretKey'];
}

function encryptedFormFields(provider: string) {
  if (provider === 'google_meet') {
    return [
      { formKey: 'apiKey', configKeys: ['accessToken', 'apiKey', 'secretKey'], clearKey: 'clearApiKey' },
      { formKey: 'clientSecret', configKeys: ['clientSecret'], clearKey: 'clearClientSecret' },
      { formKey: 'refreshToken', configKeys: ['refreshToken'], clearKey: 'clearRefreshToken' },
    ];
  }
  return [{ formKey: 'apiKey', configKeys: providerSecretKeys(provider), clearKey: 'clearApiKey' }];
}

function validateHttpUrl(input: string, label: string) {
  if (!input) return;
  try {
    const parsed = new URL(input);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    throw new Error(`${label} must be a valid http or https URL.`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(value(form, 'csrfToken')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'update';
    const provider = value(form, 'provider');

    if (!provider) return fail('Provider is required', 422);
    if (!providerKeys[provider]) return fail('Unsupported integration provider.', 422);

    if (action === 'delete') {
      await prisma.integrationSetting.deleteMany({ where: { provider } });
      await audit({ actorId: admin.id, action: 'integration.reset', entity: 'IntegrationSetting', entityId: provider });
      return NextResponse.redirect(new URL('/admin/integrations', req.url), 303);
    }

    const existing = await prisma.integrationSetting.findUnique({ where: { provider } });
    const currentConfig = fromJsonObject(existing?.config);
    const mode = allowedModes.has(value(form, 'mode')) ? value(form, 'mode') : 'test';
    const config: Record<string, unknown> = { ...currentConfig, mode };

    for (const key of providerKeys[provider]) {
      if (key === 'apiKey' || key === 'webhookSecret' || key === 'clientSecret' || key === 'refreshToken') continue;
      setPlain(config, key, value(form, key));
    }
    const genericTracking = value(form, 'trackingId');
    const targetKey = genericTrackingTarget[provider];
    if (genericTracking && targetKey && providerKeys[provider].includes(targetKey) && !value(form, targetKey)) {
      setPlain(config, targetKey, genericTracking);
    }

    validateHttpUrl(value(form, 'webhookUrl'), 'Webhook URL');
    for (const field of encryptedFormFields(provider)) {
      for (const key of field.configKeys) {
        setEncrypted(config, key, value(form, field.formKey), form.get(field.clearKey) === 'on');
      }
    }
    setEncrypted(config, 'webhookSecret', value(form, 'webhookSecret'), form.get('clearWebhookSecret') === 'on');

    const row = await prisma.integrationSetting.upsert({
      where: { provider },
      update: { config: toJson(config), active: form.get('active') === 'on' },
      create: { provider, config: toJson(config), active: form.get('active') === 'on' },
    });

    await audit({ actorId: admin.id, action: 'integration.update', entity: 'IntegrationSetting', entityId: row.id, metadata: { provider, mode } });
    return NextResponse.redirect(new URL('/admin/integrations', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Integration update failed.', 500);
  }
}
