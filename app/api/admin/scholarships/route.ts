import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const allowedStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/scholarships', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function percent(form: FormData) {
  const amount = Number(form.get('percent') || 0);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) throw new Error('Percent must be an integer between 1 and 100.');
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
      await prisma.scholarshipApplication.update({ where: { id: applicationId }, data: { status } });
      await audit({ actorId: admin.id, action: 'scholarship_application.status', entity: 'ScholarshipApplication', entityId: applicationId, metadata: { status } });
      return redirect(req);
    }

    if (action === 'delete') {
      if (!id) return fail('Scholarship id is required.', 422);
      await prisma.scholarshipApplication.deleteMany({ where: { scholarshipId: id } });
      await prisma.scholarship.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'scholarship.delete', entity: 'Scholarship', entityId: id });
      return redirect(req);
    }

    if (action === 'toggle') {
      if (!id) return fail('Scholarship id is required.', 422);
      const current = await prisma.scholarship.findUnique({ where: { id } });
      if (!current) return fail('Scholarship not found.', 404);
      const scholarship = await prisma.scholarship.update({ where: { id }, data: { active: !current.active } });
      await audit({ actorId: admin.id, action: scholarship.active ? 'scholarship.enable' : 'scholarship.disable', entity: 'Scholarship', entityId: id });
      return redirect(req);
    }

    const title = value(form, 'title');
    const description = value(form, 'description');
    const discountPercent = percent(form);
    if (title.length < 3) return fail('Scholarship title must be at least 3 characters.', 422);
    if (description.length < 10) return fail('Scholarship description must be at least 10 characters.', 422);

    const data = { title, description, percent: discountPercent, active: form.get('active') === 'on' };
    if (action === 'update') {
      if (!id) return fail('Scholarship id is required.', 422);
      await prisma.scholarship.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'scholarship.update', entity: 'Scholarship', entityId: id });
      return redirect(req);
    }

    const scholarship = await prisma.scholarship.create({ data });
    await audit({ actorId: admin.id, action: 'scholarship.create', entity: 'Scholarship', entityId: scholarship.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Scholarship update failed.', 500);
  }
}
