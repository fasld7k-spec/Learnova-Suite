import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/organizations', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Organization id is required.', 422);
      await prisma.organizationMember.deleteMany({ where: { organizationId: id } });
      await prisma.procurementRequest.updateMany({ where: { organizationId: id }, data: { organizationId: null } });
      await prisma.purchaseOrder.updateMany({ where: { organizationId: id }, data: { organizationId: null } });
      await prisma.organization.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'organization.delete', entity: 'Organization', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Organization id is required.', 422);
      const current = await prisma.organization.findUnique({ where: { id } });
      if (!current) return fail('Organization not found.', 404);
      const organization = await prisma.organization.update({ where: { id }, data: { active: !current.active } });
      await audit({
        actorId: admin.id,
        action: organization.active ? 'organization.enable' : 'organization.disable',
        entity: 'Organization',
        entityId: id,
      });
      return redirect(req);
    }

    const name = value(form, 'name');
    const slug = slugify(value(form, 'slug') || name);
    const ownerId = value(form, 'ownerId');
    const logoUrl = value(form, 'logoUrl') || null;
    const active = form.get('active') === 'on';
    if (name.length < 2) return fail('Organization name is required.', 422);
    if (slug.length < 2) return fail('Organization slug is required.', 422);
    if (!ownerId) return fail('Owner is required.', 422);
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) return fail('Owner not found.', 404);

    const data = { name, slug, ownerId, logoUrl, active };
    if (action === 'update') {
      if (!id) return fail('Organization id is required.', 422);
      await prisma.organization.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'organization.update', entity: 'Organization', entityId: id });
      return redirect(req);
    }

    const organization = await prisma.organization.create({ data });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: ownerId } },
      update: { role: 'OWNER' },
      create: { organizationId: organization.id, userId: ownerId, role: 'OWNER' },
    });
    await audit({ actorId: admin.id, action: 'organization.create', entity: 'Organization', entityId: organization.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Organization update failed.', 500);
  }
}
