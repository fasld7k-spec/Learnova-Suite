import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const order = await prisma.order.findFirst({ where: { id: String(f.get('orderId')), userId: user.id } });
    if (!order) return fail('Order not found', 404);
    if (order.status !== 'PAID') return fail('Only paid orders can be refunded.', 422);
    const reason = String(f.get('reason') || '').trim().slice(0, 2000);
    if (!reason) return fail('Please describe the reason for the refund.', 422);

    const open = await prisma.refundRequest.findFirst({
      where: { orderId: order.id, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true },
    });
    if (open) return fail('A refund request for this order already exists.', 409);

    await prisma.refundRequest.create({
      data: { userId: user.id, orderId: order.id, reason }
    });

    return NextResponse.redirect(new URL('/student/refunds', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
