import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/vendors', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function cleanWebsite(raw: string) {
  if (!raw) return '';
  try {
    return new URL(raw).toString();
  } catch {
    throw new Error('Website must be a valid absolute URL.');
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
      if (!id) return fail('Vendor id is required.', 422);
      await prisma.vendorContract.deleteMany({ where: { vendorId: id } });
      await prisma.vendor.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'vendor.delete', entity: 'Vendor', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Vendor id is required.', 422);
      const current = await prisma.vendor.findUnique({ where: { id } });
      if (!current) return fail('Vendor not found.', 404);
      await prisma.vendor.update({ where: { id }, data: { active: !current.active } });
      return redirect(req);
    }

    const name = value(form, 'name');
    const email = value(form, 'email').toLowerCase();
    const website = cleanWebsite(value(form, 'website'));
    if (name.length < 2) return fail('Vendor name is required.', 422);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Vendor email is invalid.', 422);
    const data = { name, email, website, active: form.get('active') === 'on' };

    if (action === 'update') {
      if (!id) return fail('Vendor id is required.', 422);
      await prisma.vendor.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'vendor.update', entity: 'Vendor', entityId: id });
      return redirect(req);
    }

    const vendor = await prisma.vendor.create({ data });
    await audit({ actorId: admin.id, action: 'vendor.create', entity: 'Vendor', entityId: vendor.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Vendor update failed.', 500);
  }
}
