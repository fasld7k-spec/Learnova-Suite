import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/vendor-contracts', req.url), 303);
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

function dateOrNull(raw: string) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid contract date.');
  return date;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Contract id is required.', 422);
      await prisma.vendorContract.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'vendor_contract.delete', entity: 'VendorContract', entityId: id });
      return redirect(req);
    }

    const vendorId = value(form, 'vendorId');
    const title = value(form, 'title');
    const fileUrl = cleanUrl(value(form, 'fileUrl'));
    const startsAt = dateOrNull(value(form, 'startsAt'));
    const endsAt = dateOrNull(value(form, 'endsAt'));
    const status = value(form, 'status').toUpperCase() || 'ACTIVE';
    if (!vendorId) return fail('Vendor is required.', 422);
    if (title.length < 3) return fail('Contract title must be at least 3 characters.', 422);
    if (!statuses.has(status)) return fail('Invalid contract status.', 422);
    if (startsAt && endsAt && endsAt < startsAt) return fail('End date must be after start date.', 422);
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) return fail('Vendor not found.', 404);

    const data = { vendorId, title, fileUrl, startsAt, endsAt, status };
    if (action === 'update') {
      if (!id) return fail('Contract id is required.', 422);
      await prisma.vendorContract.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'vendor_contract.update', entity: 'VendorContract', entityId: id, metadata: { status } });
      return redirect(req);
    }

    const contract = await prisma.vendorContract.create({ data });
    await audit({ actorId: admin.id, action: 'vendor_contract.create', entity: 'VendorContract', entityId: contract.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Vendor contract update failed.', 500);
  }
}
