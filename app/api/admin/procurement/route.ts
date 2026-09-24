import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'CLOSED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/procurement', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function budgetValue(form: FormData) {
  const budget = Number(form.get('budget') || 0);
  if (!Number.isFinite(budget) || budget < 0) throw new Error('Budget must be a valid non-negative amount.');
  return budget;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Procurement request id is required.', 422);
      await prisma.procurementRequest.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'procurement.delete', entity: 'ProcurementRequest', entityId: id });
      return redirect(req);
    }

    const title = value(form, 'title');
    const organizationId = value(form, 'organizationId') || null;
    const budget = budgetValue(form);
    const status = value(form, 'status').toUpperCase() || 'PENDING';
    if (title.length < 3) return fail('Request title must be at least 3 characters.', 422);
    if (!statuses.has(status)) return fail('Invalid procurement status.', 422);

    const data = { title, organizationId, budget, status };
    if (action === 'update') {
      if (!id) return fail('Procurement request id is required.', 422);
      await prisma.procurementRequest.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'procurement.update', entity: 'ProcurementRequest', entityId: id, metadata: { status } });
      return redirect(req);
    }

    const row = await prisma.procurementRequest.create({ data: { ...data, requesterId: admin.id } });
    await audit({ actorId: admin.id, action: 'procurement.create', entity: 'ProcurementRequest', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Procurement update failed.', 500);
  }
}
