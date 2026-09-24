import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser, type Role } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

const roles = ['ADMIN', 'INSTRUCTOR', 'STUDENT'] as const;
const statuses = ['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'] as const;

function isRole(value: string): value is Role {
  return roles.includes(value as Role);
}

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/admin/users', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    if (!can(admin.role as Role, 'manage_users')) throw new Error('FORBIDDEN');

    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);

    const id = String(form.get('id') || '');
    const action = String(form.get('action') || '');
    const role = String(form.get('role') || '');
    const status = String(form.get('status') || '');

    if (!id) return formError(req, 'Missing user id');
    if (id === admin.id && ['setRole', 'setStatus', 'suspend'].includes(action)) {
      if (action === 'setRole' && role !== 'ADMIN') return formError(req, 'You cannot remove your own admin role.');
      if (action === 'setStatus' && ['REJECTED', 'SUSPENDED'].includes(status)) return formError(req, 'You cannot deactivate your own admin account.');
      if (action === 'suspend') return formError(req, 'You cannot suspend your own admin account.');
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true, status: true, email: true, name: true } });
    if (!target) return formError(req, 'User not found', 404);
    const removesAdminRole = target.role === 'ADMIN' && action === 'setRole' && role !== 'ADMIN';
    const deactivatesAdmin = target.role === 'ADMIN' && (
      action === 'suspend' ||
      (action === 'setStatus' && ['REJECTED', 'SUSPENDED'].includes(status))
    );
    if (removesAdminRole || deactivatesAdmin) {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', status: { notIn: ['REJECTED', 'SUSPENDED'] } } });
      if (adminCount <= 1) return formError(req, 'At least one active admin account is required.');
    }

    if (action === 'setRole') {
      if (!isRole(role)) return formError(req, 'Invalid role');
      await prisma.user.update({ where: { id }, data: { role } });
      await audit({ actorId: admin.id, action: 'user.setRole', entity: 'user', entityId: id, metadata: { from: target.role, to: role, email: target.email } });
    } else if (action === 'setStatus') {
      if (!statuses.includes(status as (typeof statuses)[number])) return formError(req, 'Invalid status');
      await prisma.user.update({ where: { id }, data: { status } });
      await audit({ actorId: admin.id, action: 'user.setStatus', entity: 'user', entityId: id, metadata: { from: target.status, to: status, email: target.email } });
    } else if (action === 'suspend') {
      if (!can(admin.role as Role, 'block_users')) throw new Error('FORBIDDEN');
      await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
      await audit({ actorId: admin.id, action: 'user.suspend', entity: 'user', entityId: id, metadata: { from: target.status, to: 'SUSPENDED', email: target.email } });
    } else if (action === 'activate') {
      if (!can(admin.role as Role, 'block_users')) throw new Error('FORBIDDEN');
      await prisma.user.update({ where: { id }, data: { status: 'APPROVED' } });
      await audit({ actorId: admin.id, action: 'user.activate', entity: 'user', entityId: id, metadata: { from: target.status, to: 'APPROVED', email: target.email } });
    } else {
      return formError(req, 'Unsupported action');
    }

    return NextResponse.redirect(new URL('/admin/users', req.url), 303);
  } catch (e: any) {
    return formError(req, e.message === 'FORBIDDEN' ? 'Forbidden' : e.message || 'Unable to update user', e.message === 'FORBIDDEN' ? 403 : 500);
  }
}
