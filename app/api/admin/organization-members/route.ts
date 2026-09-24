import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const roleOptions = new Set(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/organization-members', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function normalizeRole(raw: string) {
  const role = raw.toUpperCase().replace(/[^A-Z_]/g, '_');
  if (!roleOptions.has(role)) throw new Error('Organization role is invalid.');
  return role;
}

async function assertOrganizationAndUser(organizationId: string, userId: string) {
  if (!organizationId || !userId) throw new Error('Organization and user are required.');
  const [organization, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ]);
  if (!organization) throw new Error('Organization not found.');
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
      if (!id) return fail('Organization member id is required.', 422);
      await prisma.organizationMember.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'organization_member.delete', entity: 'OrganizationMember', entityId: id });
      return redirect(req);
    }

    const organizationId = value(form, 'organizationId');
    const userId = value(form, 'userId');
    const role = normalizeRole(value(form, 'role') || 'MEMBER');
    await assertOrganizationAndUser(organizationId, userId);

    if (action === 'update') {
      if (!id) return fail('Organization member id is required.', 422);
      await prisma.organizationMember.update({ where: { id }, data: { organizationId, userId, role } });
      await audit({ actorId: admin.id, action: 'organization_member.update', entity: 'OrganizationMember', entityId: id });
      return redirect(req);
    }

    const member = await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      update: { role },
      create: { organizationId, userId, role },
    });
    await audit({ actorId: admin.id, action: 'organization_member.upsert', entity: 'OrganizationMember', entityId: member.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Organization member update failed.', 500);
  }
}
