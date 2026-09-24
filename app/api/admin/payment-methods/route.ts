import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { SUPPORTED_GATEWAYS } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/payment-methods', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function isBuiltInGateway(slug: string) {
  return (SUPPORTED_GATEWAYS as readonly string[]).includes(slug);
}

function paymentMethodConfig(slug: string, currentConfig: unknown) {
  const config = fromJsonObject<Record<string, unknown>>(currentConfig);
  if (isBuiltInGateway(slug)) return config;

  return {
    ...config,
    mode: String(config.mode || 'offline'),
    providerType: 'offline',
  };
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Payment method id is required.', 422);
      const current = await prisma.paymentMethod.findUnique({ where: { id } });
      if (!current) return fail('Payment method not found.', 404);
      const row = await prisma.paymentMethod.update({
        where: { id },
        data: {
          active: false,
          instructions: '',
          config: toJson(paymentMethodConfig(current.slug, {})),
        },
      });
      await audit({
        actorId: admin.id,
        action: 'payment_method.reset',
        entity: 'PaymentMethod',
        entityId: id,
        metadata: { slug: row.slug },
      });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Payment method id is required.', 422);
      const current = await prisma.paymentMethod.findUnique({ where: { id } });
      if (!current) return fail('Payment method not found.', 404);
      const row = await prisma.paymentMethod.update({ where: { id }, data: { active: !current.active } });
      await audit({
        actorId: admin.id,
        action: row.active ? 'payment_method.enable' : 'payment_method.disable',
        entity: 'PaymentMethod',
        entityId: id,
        metadata: { slug: row.slug },
      });
      return redirect(req);
    }

    const name = value(form, 'name');
    const slug = slugify(value(form, 'slug') || name);
    const instructions = value(form, 'instructions') || null;
    const active = form.get('active') === 'on';
    if (name.length < 2) return fail('Payment method name is required.', 422);
    if (slug.length < 2) return fail('Payment method slug is required.', 422);

    if (action === 'update') {
      if (!id) return fail('Payment method id is required.', 422);
      const existing = await prisma.paymentMethod.findUnique({ where: { id } });
      if (!existing) return fail('Payment method not found.', 404);
      const data = { name, slug, active, instructions, config: toJson(paymentMethodConfig(slug, existing.config)) };
      const row = await prisma.paymentMethod.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'payment_method.update', entity: 'PaymentMethod', entityId: id, metadata: { slug: row.slug, mode: fromJsonObject<any>(row.config).mode || 'gateway' } });
      return redirect(req);
    }

    const existing = await prisma.paymentMethod.findUnique({ where: { slug } });
    const data = { name, slug, active, instructions, config: toJson(paymentMethodConfig(slug, existing?.config)) };
    const row = await prisma.paymentMethod.upsert({ where: { slug }, update: data, create: data });
    await audit({ actorId: admin.id, action: 'payment_method.upsert', entity: 'PaymentMethod', entityId: row.id, metadata: { slug: row.slug, mode: fromJsonObject<any>(row.config).mode || 'gateway' } });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Payment method update failed.', 500);
  }
}
