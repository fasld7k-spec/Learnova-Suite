import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { SUPPORTED_GATEWAYS, gatewayLabels } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/secret-fields';
import { assertAllowedPayPalBaseUrl } from '@/lib/egress-url';
import { validateStoredUrl } from '@/lib/url-validation';
import { verifyCsrf } from '@/lib/csrf';

const plainConfigKeys = [
  'mode',
  'publicKey',
  'accountId',
  'webhookLabel',
  'checkoutUrl',
  'checkoutInstructions',
  'baseUrl',
  'keyId',
  'integrationId',
  'iframeId',
  'clientKey',
  'storeId',
  'entityId',
  'merchantId',
  'terminalId',
  'currency',
  'country',
];

const secretConfigKeys = [
  'secretKey',
  'apiKey',
  'clientSecret',
  'webhookSecret',
  'webhookToken',
  'signingSecret',
  'keySecret',
  'hmacSecret',
  'serverKey',
  'storePassword',
  'paymobApiKey',
  'publicCert',
];

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function redirect(req: NextRequest, slug?: string) {
  return NextResponse.redirect(new URL(`/admin/payment-gateways${slug ? `#${encodeURIComponent(slug)}` : ''}`, req.url), 303);
}

function allowedGateway(slug: string) {
  return (SUPPORTED_GATEWAYS as readonly string[]).filter((gateway) => gateway !== 'free').includes(slug);
}

function nextConfig(form: FormData, currentConfig: Record<string, unknown>, slug: string) {
  const config: Record<string, unknown> = { ...currentConfig };

  for (const key of plainConfigKeys) {
    const next = value(form, key);
    if (key === 'baseUrl' && slug === 'paypal') {
      config[key] = next ? assertAllowedPayPalBaseUrl(next) : '';
      continue;
    }
    if (key === 'checkoutUrl' || key === 'baseUrl') {
      if (next || form.has(key)) config[key] = validateStoredUrl(next, { label: key === 'checkoutUrl' ? 'Hosted checkout URL' : 'Gateway base URL' });
    } else if (next || form.has(key)) {
      config[key] = next;
    }
  }

  for (const key of secretConfigKeys) {
    const next = value(form, key);
    if (form.get(`clear_${key}`) === 'on') {
      config[key] = '';
    } else if (next) {
      config[key] = encryptSecret(next);
    } else if (!(key in config)) {
      config[key] = '';
    }
  }

  if (config.secretKey && !config.apiKey) config.apiKey = config.secretKey;
  if (config.apiKey && !config.secretKey) config.secretKey = config.apiKey;

  return config;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'upsert';
    const slug = value(form, 'slug');
    if (!slug) return fail('Gateway is required', 422);
    if (!allowedGateway(slug)) return fail('Unsupported payment gateway.', 422);

    const existing = slug ? await prisma.paymentMethod.findUnique({ where: { slug } }) : null;

    if (action === 'toggle') {
      const row = existing || await prisma.paymentMethod.create({
        data: {
          slug,
          name: gatewayLabels[slug] || slug,
          active: false,
          instructions: '',
          config: toJson({ mode: 'sandbox' }),
        },
      });
      const paymentMethod = await prisma.paymentMethod.update({ where: { id: row.id }, data: { active: !row.active } });
      await audit({ actorId: admin.id, action: 'paymentGateway.toggle', entity: 'paymentMethod', entityId: paymentMethod.id, metadata: { slug, active: paymentMethod.active } });
      return redirect(req, slug);
    }

    if (action === 'delete') {
      if (!existing) return redirect(req, slug);
      const paymentMethod = await prisma.paymentMethod.update({
        where: { id: existing.id },
        data: {
          active: false,
          instructions: '',
          config: toJson({ mode: 'sandbox' }),
        },
      });
      await audit({
        actorId: admin.id,
        action: 'paymentGateway.reset',
        entity: 'paymentMethod',
        entityId: paymentMethod.id,
        metadata: { slug, active: paymentMethod.active },
      });
      return redirect(req, slug);
    }

    const currentConfig = fromJsonObject<Record<string, unknown>>(existing?.config);
    const config = nextConfig(form, currentConfig, slug);
    const mode = String(config.mode || 'sandbox');

    const paymentMethod = await prisma.paymentMethod.upsert({
      where: { slug },
      update: {
        name: value(form, 'name') || gatewayLabels[slug] || slug,
        active: form.get('active') === 'on',
        instructions: value(form, 'instructions') || existing?.instructions || '',
        config: toJson(config),
      },
      create: {
        slug,
        name: value(form, 'name') || gatewayLabels[slug] || slug,
        active: form.get('active') === 'on',
        instructions: value(form, 'instructions'),
        config: toJson(config),
      },
    });
    await audit({
      actorId: admin.id,
      action: existing ? 'paymentGateway.update' : 'paymentGateway.create',
      entity: 'paymentMethod',
      entityId: paymentMethod.id,
      metadata: {
        slug: paymentMethod.slug,
        active: paymentMethod.active,
        mode,
        hasPublicKey: Boolean(config.publicKey),
        hasSecretKey: Boolean(config.secretKey || config.apiKey),
        hasClientSecret: Boolean(config.clientSecret),
        hasWebhookSecret: Boolean(config.webhookSecret || config.webhookToken || config.signingSecret || config.hmacSecret),
      },
    });

    return redirect(req, slug);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
