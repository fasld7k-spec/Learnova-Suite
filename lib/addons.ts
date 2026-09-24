import { z } from 'zod';
import { createHmac } from 'crypto';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/secret-fields';
import { assertSafeServerUrl } from '@/lib/egress-url';

export const addonSettingSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{1,80}$/),
  label: z.string().min(2).max(120),
  type: z.enum(['text', 'password', 'textarea', 'url', 'number', 'boolean', 'select']).default('text'),
  required: z.boolean().optional().default(false),
  secret: z.boolean().optional().default(false),
  helpText: z.string().max(240).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string().min(1).max(80)).optional().default([]),
});

export const addonExtensionPoints = [
  'runtime.certificate.rules',
  'runtime.live-class.booking',
  'runtime.affiliate.tracking',
  'email.template.variable',
  'webhook.event.handler',
] as const;

export const addonManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/).optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/).optional(),
  name: z.string().min(2).max(120),
  version: z.string().min(1).max(40).default('1.0.0'),
  description: z.string().max(600).default(''),
  author: z.string().max(120).optional().default(''),
  category: z.string().max(80).optional().default('General'),
  docsUrl: z.string().url().optional().or(z.literal('')).default(''),
  adminPath: z.string().startsWith('/').optional().or(z.literal('')).default(''),
  webhookUrl: z.string().url().optional().or(z.literal('')).default(''),
  permissions: z.array(z.string().min(2).max(80)).optional().default([]),
  extensionPoints: z.array(z.enum(addonExtensionPoints)).optional().default([]),
  settings: z.array(addonSettingSchema).optional().default([]),
}).refine((manifest) => Boolean(manifest.slug || manifest.id), {
  message: 'Addon manifest must include slug or id.',
});

export type AddonManifest = Omit<z.infer<typeof addonManifestSchema>, 'id' | 'slug'> & {
  id: string;
  slug: string;
};
export type AddonSetting = z.infer<typeof addonSettingSchema>;
export type AddonExtensionPoint = (typeof addonExtensionPoints)[number];

export const defaultAddonCatalog: AddonManifest[] = [
  {
    id: 'advanced-certificates',
    slug: 'advanced-certificates',
    name: 'Advanced Certificates',
    version: '1.0.0',
    description: 'Adds configurable certificate styles, verification blocks, and completion rules.',
    author: 'Learnova Suite',
    category: 'Learning',
    docsUrl: '',
    adminPath: '/admin/certificate-templates',
    webhookUrl: '',
    permissions: ['certificates:read', 'certificates:write'],
    extensionPoints: ['runtime.certificate.rules'],
    settings: [
      { key: 'certificatePrefix', label: 'Certificate prefix', type: 'text', required: false, secret: false, options: [], defaultValue: 'CERT' },
      { key: 'showQrCode', label: 'Show QR code', type: 'boolean', required: false, secret: false, options: [], defaultValue: true },
    ],
  },
  {
    id: 'live-class-booking',
    slug: 'live-class-booking',
    name: 'Live Class Booking Pack',
    version: '1.0.0',
    description: 'Connects instructor availability, live sessions, booking limits, and reminder hooks.',
    author: 'Learnova Suite',
    category: 'Live Learning',
    docsUrl: '',
    adminPath: '/admin/live-sessions',
    webhookUrl: '',
    permissions: ['live-sessions:read', 'live-sessions:write'],
    extensionPoints: ['runtime.live-class.booking', 'webhook.event.handler'],
    settings: [
      { key: 'defaultSessionLength', label: 'Default session length', type: 'number', required: false, secret: false, options: [], defaultValue: 60 },
      { key: 'allowFreePreview', label: 'Allow free live previews', type: 'boolean', required: false, secret: false, options: [], defaultValue: true },
    ],
  },
  {
    id: 'affiliate-growth',
    slug: 'affiliate-growth',
    name: 'Affiliate Growth Kit',
    version: '1.0.0',
    description: 'Adds affiliate campaign settings, commission defaults, and conversion widgets.',
    author: 'Learnova Suite',
    category: 'Marketing',
    docsUrl: '',
    adminPath: '/admin/affiliates',
    webhookUrl: '',
    permissions: ['affiliates:read', 'affiliates:write'],
    extensionPoints: ['runtime.affiliate.tracking', 'webhook.event.handler'],
    settings: [
      { key: 'defaultCommission', label: 'Default commission percentage', type: 'number', required: false, secret: false, options: [], defaultValue: 15 },
      { key: 'cookieDays', label: 'Tracking cookie days', type: 'number', required: false, secret: false, options: [], defaultValue: 30 },
    ],
  },
];

function parseManifestInput(input: unknown) {
  if (typeof input !== 'string') return input;
  return JSON.parse(input);
}

export function normalizeAddonManifest(input: unknown): AddonManifest {
  const parsed = addonManifestSchema.parse(parseManifestInput(input));
  const slug = parsed.slug || parsed.id;
  if (!slug) throw new Error('Addon manifest must include slug or id.');
  const settings = [...parsed.settings];
  if (parsed.webhookUrl && !settings.some((field) => field.key === 'webhookSecret' || field.key === 'signingSecret')) {
    settings.push({
      key: 'webhookSecret',
      label: 'Webhook signing secret',
      type: 'password',
      required: false,
      secret: true,
      options: [],
      helpText: 'Optional secret used to sign x-learnova-signature webhook payloads for this add-on.',
    });
  }
  return {
    ...parsed,
    id: parsed.id || slug,
    slug,
    settings,
    permissions: Array.from(new Set(parsed.permissions)),
    extensionPoints: Array.from(new Set(parsed.extensionPoints)),
  };
}

export function addonConfigFromManifest(manifest: AddonManifest, extra: Record<string, unknown> = {}) {
  return toJson({
    ...extra,
    manifest,
    version: manifest.version,
    category: manifest.category,
    docsUrl: manifest.docsUrl,
    adminPath: manifest.adminPath,
    webhookUrl: manifest.webhookUrl,
    permissions: manifest.permissions,
    extensionPoints: manifest.extensionPoints,
    settingsSchema: manifest.settings,
  });
}

export function manifestFromConfig(config: unknown): AddonManifest | null {
  const object = fromJsonObject(config);
  const manifest = object.manifest;
  if (!manifest) return null;
  try {
    return normalizeAddonManifest(manifest);
  } catch {
    return null;
  }
}

export function addonCategory(config: unknown) {
  const object = fromJsonObject(config);
  return String(object.category || manifestFromConfig(config)?.category || 'General');
}

export function addonVersion(config: unknown) {
  const object = fromJsonObject(config);
  return String(object.version || manifestFromConfig(config)?.version || '1.0.0');
}

export function addonSettingsSchema(config: unknown): AddonSetting[] {
  const manifest = manifestFromConfig(config);
  return manifest?.settings || [];
}

export function addonExtensionSummary(config: unknown) {
  const manifest = manifestFromConfig(config);
  return manifest?.extensionPoints || [];
}

export async function getAddonRuntime(slug: string) {
  const app = await prisma.marketplaceApp.findUnique({ where: { slug } });
  const installation = app
    ? await prisma.appInstallation.findFirst({ where: { appId: app.id, tenantId: null, userId: null } })
    : null;
  const manifest = app ? manifestFromConfig(app.config) : null;
  const savedSettings = fromJsonObject(installation?.config);
  const settings: Record<string, unknown> = {};

  for (const field of manifest?.settings || []) {
    settings[field.key] = savedSettings[field.key] ?? field.defaultValue ?? (field.type === 'boolean' ? false : '');
  }

  return {
    app,
    installation,
    manifest,
    settings,
    active: Boolean(app?.installed && installation?.active),
  };
}

export async function isAddonActive(slug: string) {
  return (await getAddonRuntime(slug)).active;
}

export function addonNumberSetting(settings: Record<string, unknown>, key: string, fallback: number) {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function addonBooleanSetting(settings: Record<string, unknown>, key: string, fallback: boolean) {
  const value = settings[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function addonStringSetting(settings: Record<string, unknown>, key: string, fallback: string) {
  const value = settings[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export type AddonEventName =
  | 'addon.test'
  | 'order.paid'
  | 'certificate.issued'
  | 'live-session.created'
  | 'live-session.updated'
  | 'live-session.deleted';

type AddonEventOptions = {
  extensionPoint?: AddonExtensionPoint;
};

async function postAddonWebhook({
  app,
  installation,
  event,
  payload,
}: {
  app: Awaited<ReturnType<typeof prisma.marketplaceApp.findMany>>[number];
  installation: Awaited<ReturnType<typeof prisma.appInstallation.findMany>>[number];
  event: AddonEventName;
  payload: Record<string, unknown>;
}) {
  const manifest = manifestFromConfig(app.config);
  if (!manifest?.webhookUrl) return;

  const settings = fromJsonObject(installation.config);
  const secret = decryptSecret(settings.webhookSecret || settings.signingSecret || settings.secret);
  const body = JSON.stringify({
    event,
    sentAt: new Date().toISOString(),
    addon: {
      id: manifest.id,
      slug: manifest.slug,
      name: manifest.name,
      version: manifest.version,
    },
    payload,
  });
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-learnova-addon': manifest.slug,
    'x-learnova-event': event,
  };
  if (secret) headers['x-learnova-signature'] = createHmac('sha256', secret).update(body).digest('hex');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = await assertSafeServerUrl(manifest.webhookUrl, { label: 'Add-on webhook URL' });
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    });
    await prisma.auditLog.create({
      data: {
        action: 'ADDON_WEBHOOK_DELIVERED',
        entity: 'MarketplaceApp',
        entityId: app.id,
        metadata: toJson({
          event,
          addon: manifest.slug,
          status: response.status,
          ok: response.ok,
        }),
      },
    }).catch(() => null);
  } catch (error) {
    await prisma.auditLog.create({
      data: {
        action: 'ADDON_WEBHOOK_FAILED',
        entity: 'MarketplaceApp',
        entityId: app.id,
        metadata: toJson({
          event,
          addon: manifest.slug,
          message: error instanceof Error ? error.message : String(error),
        }),
      },
    }).catch(() => null);
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchAddonEvent(
  event: AddonEventName,
  payload: Record<string, unknown>,
  options: AddonEventOptions = {},
) {
  const extensionPoint = options.extensionPoint || 'webhook.event.handler';
  const installations = await prisma.appInstallation.findMany({
    where: { active: true, tenantId: null, userId: null },
  });
  if (!installations.length) return { delivered: 0 };

  const apps = await prisma.marketplaceApp.findMany({
    where: {
      id: { in: installations.map((installation) => installation.appId) },
      installed: true,
    },
  });
  const appById = new Map(apps.map((app) => [app.id, app]));
  const deliveries = installations
    .map((installation) => ({ installation, app: appById.get(installation.appId) }))
    .filter(({ app }) => {
      const manifest = app ? manifestFromConfig(app.config) : null;
      return Boolean(manifest?.webhookUrl && manifest.extensionPoints.includes(extensionPoint));
    });

  await Promise.allSettled(
    deliveries.map(({ app, installation }) =>
      postAddonWebhook({ app: app!, installation, event, payload }),
    ),
  );
  return { delivered: deliveries.length };
}

export async function sendAddonWebhookTest(appId: string, actorId?: string) {
  const app = await prisma.marketplaceApp.findUnique({ where: { id: appId } });
  if (!app?.installed) throw new Error('Add-on is not installed.');
  const installation = await prisma.appInstallation.findFirst({ where: { appId, tenantId: null, userId: null } });
  if (!installation?.active) throw new Error('Add-on is not active.');

  const manifest = manifestFromConfig(app.config);
  if (!manifest?.webhookUrl) throw new Error('Add-on does not define a webhook URL.');

  await postAddonWebhook({
    app,
    installation,
    event: 'addon.test',
    payload: {
      appId: app.id,
      slug: app.slug,
      triggeredBy: actorId || 'admin',
      message: 'Learnova Suite add-on webhook test event.',
    },
  });

  return { sent: true, slug: app.slug };
}
