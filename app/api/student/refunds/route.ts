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

    await prisma.refundRequest.create({
      data: { userId: user.id, orderId: order.id, reason: String(f.get('reason')) }
    });

    return NextResponse.redirect(new URL('/student/refunds', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
