import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['OPEN', 'APPROVED', 'PAID', 'VOID']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/purchase-orders', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

function amountValue(form: FormData) {
  const amount = Number(form.get('amount') || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be a valid non-negative number.');
  return amount;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Purchase order id is required.', 422);
      await prisma.purchaseOrder.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'purchase_order.delete', entity: 'PurchaseOrder', entityId: id });
      return redirect(req);
    }

    const poNumber = value(form, 'poNumber').toUpperCase();
    const organizationId = value(form, 'organizationId') || null;
    const orderId = value(form, 'orderId') || null;
    const amount = amountValue(form);
    const status = value(form, 'status').toUpperCase() || 'OPEN';
    if (poNumber.length < 3) return fail('PO number must be at least 3 characters.', 422);
    if (!statuses.has(status)) return fail('Invalid purchase order status.', 422);
    if (organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
      if (!org) return fail('Organization not found.', 404);
    }
    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) return fail('Order not found.', 404);
    }

    const data = { poNumber, organizationId, orderId, amount, status };
    if (action === 'update') {
      if (!id) return fail('Purchase order id is required.', 422);
      await prisma.purchaseOrder.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'purchase_order.update', entity: 'PurchaseOrder', entityId: id, metadata: { status } });
      return redirect(req);
    }

    const row = await prisma.purchaseOrder.create({ data });
    await audit({ actorId: admin.id, action: 'purchase_order.create', entity: 'PurchaseOrder', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Purchase order update failed.', 500);
  }
}
