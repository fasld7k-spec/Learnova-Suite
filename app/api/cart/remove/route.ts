import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const courseId = String(form.get('courseId') || '').trim();
    if (!courseId) return fail('courseId is required', 422);

    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, courseId } });

    return NextResponse.redirect(new URL('/cart', req.url), 303);
  } catch (error) {
    return handleRouteError(error, req);
  }
}
