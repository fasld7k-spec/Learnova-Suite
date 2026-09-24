import { randomUUID } from 'crypto';
import { resolveTxt } from 'dns/promises';
import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { normalizeAppUrl } from '@/lib/app-url';
import { invalidateSiteSettingsCache } from '@/lib/cache';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { requestRedirectUrl } from '@/lib/redirect-url';
import { verifyCsrf } from '@/lib/csrf';

function normalizeDomain(value: FormDataEntryValue | null) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const asUrl = normalizeAppUrl(raw);
  const hostname = asUrl ? new URL(asUrl).hostname : raw.replace(/^https?:\/\//, '').split('/')[0];
  if (!/^[a-z0-9.-]+$/i.test(hostname) || hostname.length > 253) return '';
  return hostname.replace(/^\.+|\.+$/g, '');
}

async function verifyTxtToken(domain: string, token: string) {
  const names = [`_learnova.${domain}`, domain];
  for (const name of names) {
    const records = await resolveTxt(name).catch(() => []);
    const flatRecords = records.map((record) => record.join(''));
    if (flatRecords.some((record) => record.trim() === token || record.includes(token))) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create');
    const domain = normalizeDomain(form.get('domain'));
    if (!domain) return fail('Valid domain is required', 422);

    if (action === 'delete') {
      await prisma.domainVerification.delete({ where: { domain } });
      await audit({ actorId: admin.id, action: 'domain.delete', entity: 'DomainVerification', entityId: domain });
      return NextResponse.redirect(requestRedirectUrl(req, '/admin/domains'), 303);
    }

    if (action === 'verify') {
      const row = await prisma.domainVerification.findUnique({ where: { domain } });
      if (!row) return fail('Domain token not found', 404);
      const verified = await verifyTxtToken(row.domain, row.token);
      await prisma.domainVerification.update({ where: { domain }, data: { verified } });
      await audit({ actorId: admin.id, action: 'domain.verify', entity: 'DomainVerification', entityId: domain, metadata: { verified } });
      const url = requestRedirectUrl(req, '/admin/domains');
      url.searchParams.set('verified', verified ? '1' : '0');
      return NextResponse.redirect(url, 303);
    }

    if (action === 'set-public-url') {
      const row = await prisma.domainVerification.findUnique({ where: { domain } });
      if (!row) return fail('Domain token not found', 404);
      if (!row.verified) return fail('Verify this domain before setting it as the public site URL.', 422);

      const current = await prisma.setting.findUnique({ where: { key: 'general' } });
      const value = fromJsonObject<Record<string, unknown>>(current?.value);
      await prisma.setting.upsert({
        where: { key: 'general' },
        update: { value: toJson({ ...value, publicAppUrl: `https://${row.domain}` }) },
        create: { key: 'general', value: toJson({ publicAppUrl: `https://${row.domain}` }) },
      });
      await invalidateSiteSettingsCache();
      await audit({ actorId: admin.id, action: 'domain.set_public_url', entity: 'DomainVerification', entityId: domain });
      return NextResponse.redirect(requestRedirectUrl(req, '/admin/domains?publicUrl=1'), 303);
    }

    const token = `learnova-domain-verification=${randomUUID()}`;
    await prisma.domainVerification.upsert({
      where: { domain },
      update: { token, verified: false },
      create: { domain, token },
    });
    await audit({ actorId: admin.id, action: 'domain.upsert', entity: 'DomainVerification', entityId: domain });

    return NextResponse.redirect(requestRedirectUrl(req, '/admin/domains'), 303);
  } catch (e: any) {
    return fail(e.message || 'Unable to update domain verification', 500);
  }
}
