import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    const status = String(form.get('status') || '').toUpperCase();
    if (!id) return fail('Subscription ID is required.', 422);
    if (status !== 'CANCELED') return fail('Only cancellation is available from the student area.', 422);

    const subscription = await prisma.subscription.findFirst({ where: { id, userId: user.id }, include: { plan: true } });
    if (!subscription) return fail('Subscription was not found.', 404);
    if (subscription.status === 'CANCELED') return NextResponse.redirect(new URL('/student/subscriptions', req.url), 303);

    await prisma.subscription.update({ where: { id }, data: { status: 'CANCELED' } });
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Membership access canceled',
        body: `${subscription.plan.name} access was canceled. This stops dashboard access tracking only; sandbox checkout creates one-time access orders, not recurring gateway billing.`,
      },
    }).catch(() => null);

    return NextResponse.redirect(new URL('/student/subscriptions', req.url), 303);
  } catch (error: any) {
    return fail(error.message, /required|available|not found/i.test(error.message) ? 422 : 500);
  }
}
