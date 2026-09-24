import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { markOrderPaid } from '@/lib/payments';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const body = await req.json().catch(() => ({}));
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String(body.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const { orderId, transactionId } = body;
    const cleanOrderId = String(orderId || '').trim();
    if (!cleanOrderId) return fail('Order id is required.', 422);

    const order = await prisma.order.findUnique({ where: { id: cleanOrderId }, select: { id: true, invoiceNumber: true, status: true, gateway: true } });
    if (!order) return fail('Order not found.', 404);

    const result = await markOrderPaid(cleanOrderId, transactionId || 'manual-approved');
    await audit({
      actorId: admin.id,
      action: 'payment.manual.approve',
      entity: 'order',
      entityId: cleanOrderId,
      metadata: {
        invoiceNumber: order.invoiceNumber,
        from: order.status,
        gateway: order.gateway,
        transactionId: transactionId || 'manual-approved',
      },
    });

    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
