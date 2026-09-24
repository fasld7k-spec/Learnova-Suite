import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refreshRateLimitPolicies } from '@/lib/request-security';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/rate-limits', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function key(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_.:-]+/g, '.').replace(/^\.+|\.+$/g, '');
}

function positiveInt(raw: string, label: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Rate limit rule id is required.', 422);
      await prisma.rateLimitRule.delete({ where: { id } });
      await refreshRateLimitPolicies(true);
      await audit({ actorId: admin.id, action: 'rate_limit.delete', entity: 'RateLimitRule', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Rate limit rule id is required.', 422);
      const current = await prisma.rateLimitRule.findUnique({ where: { id } });
      if (!current) return fail('Rate limit rule not found.', 404);
      const next = await prisma.rateLimitRule.update({ where: { id }, data: { active: !current.active } });
      await refreshRateLimitPolicies(true);
      await audit({
        actorId: admin.id,
        action: next.active ? 'rate_limit.enable' : 'rate_limit.disable',
        entity: 'RateLimitRule',
        entityId: id,
      });
      return redirect(req);
    }

    const ruleKey = key(value(form, 'key'));
    const limit = positiveInt(value(form, 'limit') || '20', 'Limit');
    const windowSec = positiveInt(value(form, 'windowSec') || '60', 'Window seconds');
    if (ruleKey.length < 2) return fail('Rate limit key is required.', 422);

    const data = { key: ruleKey, limit, windowSec, active: form.get('active') === 'on' };
    if (action === 'update') {
      if (!id) return fail('Rate limit rule id is required.', 422);
      await prisma.rateLimitRule.update({ where: { id }, data });
      await refreshRateLimitPolicies(true);
      await audit({ actorId: admin.id, action: 'rate_limit.update', entity: 'RateLimitRule', entityId: id });
      return redirect(req);
    }

    const row = await prisma.rateLimitRule.upsert({ where: { key: ruleKey }, update: data, create: data });
    await refreshRateLimitPolicies(true);
    await audit({ actorId: admin.id, action: 'rate_limit.upsert', entity: 'RateLimitRule', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Rate limit update failed.', 500);
  }
}
