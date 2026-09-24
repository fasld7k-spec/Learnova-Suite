import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const allowedStatuses = new Set(['ACTIVE', 'CANCELED', 'PENDING']);

function addInterval(from: Date, interval: string) {
  const endsAt = new Date(from);
  endsAt.setMonth(endsAt.getMonth() + (interval === 'yearly' ? 12 : 1));
  return endsAt;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '');
    const status = String(form.get('status') || '').toUpperCase();

    if (!id) return fail('Subscription id is required', 422);
    if (!allowedStatuses.has(status)) return fail('Invalid subscription status.', 422);

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!subscription) return fail('Subscription not found', 404);

    const now = new Date();
    const data =
      status === 'ACTIVE'
        ? {
            status,
            startsAt: now,
            endsAt: subscription.endsAt > now ? subscription.endsAt : addInterval(now, subscription.plan.interval),
          }
        : { status };

    const updated = await prisma.subscription.update({ where: { id }, data });
    await audit({ actorId: admin.id, action: 'subscription.status.update', entity: 'Subscription', entityId: id, metadata: { status } });
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title: status === 'ACTIVE' ? 'Membership access approved' : status === 'CANCELED' ? 'Membership access canceled' : 'Membership access updated',
        body:
          status === 'ACTIVE'
            ? `Your ${subscription.plan.name} access plan is active until ${updated.endsAt.toLocaleDateString('en-US')}.`
            : `Your ${subscription.plan.name} access plan status is now ${status}.`,
      },
    });

    return NextResponse.redirect(new URL('/admin/subscription-plans', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
