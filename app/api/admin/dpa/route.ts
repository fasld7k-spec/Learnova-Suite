import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['PENDING', 'SENT', 'SIGNED', 'EXPIRED', 'REVOKED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/dpa', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function cleanUrl(raw: string) {
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    return new URL(raw).toString();
  } catch {
    throw new Error('File URL must be an absolute URL or an internal path.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('DPA id is required.', 422);
      await prisma.dpaAgreement.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'dpa.delete', entity: 'DpaAgreement', entityId: id });
      return redirect(req);
    }

    const company = value(form, 'company');
    const email = value(form, 'email').toLowerCase();
    const fileUrl = cleanUrl(value(form, 'fileUrl'));
    const status = value(form, 'status').toUpperCase() || 'PENDING';
    if (company.length < 2) return fail('Company is required.', 422);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Valid email is required.', 422);
    if (!statuses.has(status)) return fail('Invalid DPA status.', 422);

    const data = { company, email, fileUrl, status };
    if (action === 'update') {
      if (!id) return fail('DPA id is required.', 422);
      await prisma.dpaAgreement.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'dpa.update', entity: 'DpaAgreement', entityId: id, metadata: { status } });
      return redirect(req);
    }

    const row = await prisma.dpaAgreement.create({ data });
    await audit({ actorId: admin.id, action: 'dpa.create', entity: 'DpaAgreement', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'DPA update failed.', 500);
  }
}
