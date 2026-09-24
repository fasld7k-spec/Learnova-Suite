import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/tenants', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeDomain(raw: string) {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error('Domain must be a valid hostname.');
  return domain;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Tenant id is required.', 422);
      await prisma.tenantTheme.deleteMany({ where: { tenantId: id } });
      await prisma.tenantCourse.deleteMany({ where: { tenantId: id } });
      await prisma.tenantMember.deleteMany({ where: { tenantId: id } });
      await prisma.tenant.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'tenant.delete', entity: 'Tenant', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Tenant id is required.', 422);
      const current = await prisma.tenant.findUnique({ where: { id } });
      if (!current) return fail('Tenant not found.', 404);
      await prisma.tenant.update({ where: { id }, data: { active: !current.active } });
      return redirect(req);
    }

    const name = value(form, 'name');
    const slug = slugify(value(form, 'slug') || name);
    const domain = normalizeDomain(value(form, 'domain'));
    const active = form.get('active') === 'on';
    if (name.length < 2) return fail('Tenant name is required.', 422);
    if (slug.length < 2) return fail('Tenant slug is required.', 422);

    const data = { name, slug, domain, active };
    if (action === 'update') {
      if (!id) return fail('Tenant id is required.', 422);
      await prisma.tenant.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'tenant.update', entity: 'Tenant', entityId: id });
      return redirect(req);
    }

    const tenant = await prisma.tenant.create({ data });
    await audit({ actorId: admin.id, action: 'tenant.create', entity: 'Tenant', entityId: tenant.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Tenant update failed.', 500);
  }
}
