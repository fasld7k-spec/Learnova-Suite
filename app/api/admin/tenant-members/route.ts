import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const roleOptions = new Set(['OWNER', 'ADMIN', 'MANAGER', 'INSTRUCTOR', 'MEMBER', 'VIEWER']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/tenant-members', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizeRole(raw: string) {
  const role = raw.toUpperCase().replace(/[^A-Z_]/g, '_');
  if (!roleOptions.has(role)) throw new Error('Tenant role is invalid.');
  return role;
}

async function assertTenantAndUser(tenantId: string, userId: string) {
  if (!tenantId || !userId) throw new Error('Tenant and user are required.');
  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ]);
  if (!tenant) throw new Error('Tenant not found.');
  if (!user) throw new Error('User not found.');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'upsert';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Tenant member id is required.', 422);
      await prisma.tenantMember.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'tenant_member.delete', entity: 'TenantMember', entityId: id });
      return redirect(req);
    }

    const tenantId = value(form, 'tenantId');
    const userId = value(form, 'userId');
    const role = normalizeRole(value(form, 'role') || 'MEMBER');
    await assertTenantAndUser(tenantId, userId);

    if (action === 'update') {
      if (!id) return fail('Tenant member id is required.', 422);
      await prisma.tenantMember.update({ where: { id }, data: { tenantId, userId, role } });
      await audit({ actorId: admin.id, action: 'tenant_member.update', entity: 'TenantMember', entityId: id });
      return redirect(req);
    }

    const member = await prisma.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: { role },
      create: { tenantId, userId, role },
    });
    await audit({ actorId: admin.id, action: 'tenant_member.upsert', entity: 'TenantMember', entityId: member.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Tenant member update failed.', 500);
  }
}
