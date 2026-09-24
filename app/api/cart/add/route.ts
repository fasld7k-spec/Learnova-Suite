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

    const course = await prisma.course.findFirst({ where: { id: courseId, status: 'PUBLISHED' }, select: { id: true } });
    if (!course) return fail('Course not found', 404);

    const cart = await prisma.cart.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
    await prisma.cartItem.upsert({
      where: { cartId_courseId: { cartId: cart.id, courseId } },
      update: {},
      create: { cartId: cart.id, courseId },
    });

    return NextResponse.redirect(new URL('/cart', req.url), 303);
  } catch (error) {
    return handleRouteError(error, req);
  }
}
