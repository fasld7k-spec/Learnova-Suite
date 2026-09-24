import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const allowedStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/grants', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function money(form: FormData, key: string) {
  const amount = Number(form.get(key) || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${key} must be a valid non-negative amount.`);
  return amount;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'application-status') {
      const applicationId = value(form, 'applicationId');
      const status = value(form, 'status').toUpperCase();
      if (!applicationId) return fail('Application id is required.', 422);
      if (!allowedStatuses.has(status)) return fail('Invalid application status.', 422);
      await prisma.grantApplication.update({ where: { id: applicationId }, data: { status } });
      await audit({ actorId: admin.id, action: 'grant_application.status', entity: 'GrantApplication', entityId: applicationId, metadata: { status } });
      return redirect(req);
    }

    if (action === 'delete') {
      if (!id) return fail('Grant id is required.', 422);
      await prisma.grantApplication.deleteMany({ where: { grantId: id } });
      await prisma.grantProgram.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'grant_program.delete', entity: 'GrantProgram', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Grant id is required.', 422);
      const current = await prisma.grantProgram.findUnique({ where: { id } });
      if (!current) return fail('Grant not found.', 404);
      const grant = await prisma.grantProgram.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: grant.active ? 'grant_program.enable' : 'grant_program.disable', entity: 'GrantProgram', entityId: id });
      return redirect(req);
    }

    const title = value(form, 'title');
    const description = value(form, 'description');
    const budget = money(form, 'budget');
    if (title.length < 3) return fail('Grant title must be at least 3 characters.', 422);
    if (description.length < 10) return fail('Grant description must be at least 10 characters.', 422);

    const data = { title, description, budget, active: form.get('active') === 'on' };
    if (action === 'update') {
      if (!id) return fail('Grant id is required.', 422);
      await prisma.grantProgram.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'grant_program.update', entity: 'GrantProgram', entityId: id });
      return redirect(req);
    }

    const grant = await prisma.grantProgram.create({ data });
    await audit({ actorId: admin.id, action: 'grant_program.create', entity: 'GrantProgram', entityId: grant.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Grant update failed.', 500);
  }
}
