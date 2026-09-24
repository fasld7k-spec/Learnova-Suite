import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { fail, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

function verifyActivationSecret(req: NextRequest) {
  const secret = process.env.LICENSE_ACTIVATION_SECRET;
  if (!secret) return false;
  const provided = req.headers.get('x-license-secret') || '';
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizeDomain(value: unknown) {
  const domain = String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!domain || domain.length > 255 || /[/?#\s]/.test(domain)) return '';
  return domain;
}

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, 'license.activate', 20, 60_000);
    if (limited) return limited;
    if (!verifyActivationSecret(req)) return fail('Invalid license activation secret', 401);

    const body = await req.json().catch(() => null);
    const purchaseCode = String(body?.purchaseCode || '').trim();
    const domain = normalizeDomain(body?.domain);
    const email = body?.email ? String(body.email).trim().slice(0, 255) : null;

    if (!purchaseCode || !domain) return fail('purchaseCode and domain are required', 422);

    const activation = await prisma.licenseActivation.upsert({
      where: { purchaseCode },
      update: { domain, email, active: true },
      create: { purchaseCode, domain, email },
    });
    return ok({ activated: true, id: activation.id });
  } catch (e: any) {
    return fail(e?.message || 'License activation failed', 500);
  }
}
