import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { appUrlFromRequest } from '@/lib/app-url';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { createGatewaySession, ensureGatewayAvailable, normalizeGateway } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const body = await req.json().catch(() => null);
    if (!(await verifyCsrf(req.headers.get('x-csrf-token') || String(body?.csrfToken || '')))) return fail('Invalid CSRF token.', 403);
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) return fail('Order id is required.', 422);
    const order = await prisma.order.findFirst({
      where: { id: orderId, ...(user.role === 'ADMIN' ? {} : { userId: user.id }) },
    });
    if (!order) return fail('Order not found', 404);

    const gateway = normalizeGateway(body.gateway || order.gateway);
    if (gateway !== order.gateway && user.role !== 'ADMIN') return fail('Gateway cannot be changed for this order.', 403);
    if (gateway !== 'free') await ensureGatewayAvailable(gateway);

    return ok(await createGatewaySession(order.id, gateway, appUrlFromRequest(req)));
  } catch (e) {
    return handleError(e);
  }
}
