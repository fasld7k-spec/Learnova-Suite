import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { appUrlFromRequest } from '@/lib/app-url';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { paymentMetadataWithAffiliate } from '@/lib/affiliate';
import { createGatewaySession, ensureGatewayAvailable, normalizeGateway } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { featureEnabled } from '@/lib/features';
import { checkoutTaxCountry, priceCheckoutLines, resolveCheckoutPricingContext } from '@/lib/order-pricing';

function addInterval(from: Date, interval: string) {
  const endsAt = new Date(from);
  endsAt.setMonth(endsAt.getMonth() + (interval === 'yearly' ? 12 : 1));
  return endsAt;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    if (await featureEnabled('checkout_disabled')) return fail('Checkout is temporarily paused.', 503);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const planId = String(form.get('planId') || '');
    const selectedGateway = normalizeGateway(String(form.get('gateway') || 'manual'));
    if (!planId) return fail('planId is required', 422);

    const [plan, settings] = await Promise.all([
      prisma.subscriptionPlan.findFirst({ where: { id: planId, active: true } }),
      getSiteSettings(),
    ]);
    if (!plan) return fail('Plan not found', 404);

    const basePrice = Number(plan.price || 0);
    const pricingContext = await resolveCheckoutPricingContext(settings.currency, checkoutTaxCountry(form.get('taxCountry'), req.headers));
    const pricing = priceCheckoutLines({ lines: [{ courseId: `subscription:${plan.id}`, amount: basePrice }], context: pricingContext });
    const price = pricing.total;
    const gateway = price <= 0 ? 'free' : selectedGateway;
    if (gateway !== 'free') await ensureGatewayAvailable(gateway);

    const existing = await prisma.subscription.findFirst({
      where: { userId: user.id, planId: plan.id, status: 'ACTIVE' },
      orderBy: { endsAt: 'desc' },
    });
    const startsFrom = existing && existing.endsAt > new Date() ? existing.endsAt : new Date();
    const endsAt = addInterval(startsFrom, plan.interval);
    const subscription = existing
      ? await prisma.subscription.update({ where: { id: existing.id }, data: { endsAt, status: gateway === 'free' ? 'ACTIVE' : 'PENDING' } })
      : await prisma.subscription.create({ data: { userId: user.id, planId: plan.id, endsAt, status: gateway === 'free' ? 'ACTIVE' : 'PENDING' } });

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: gateway === 'free' ? existing ? 'Membership access extended' : 'Membership access activated' : 'Membership access order created',
        body: gateway === 'free'
          ? `Your ${plan.name} access plan is active until ${endsAt.toLocaleDateString('en-US')}.`
          : `Your ${plan.name} access plan order was created as a one-time payment and is waiting for payment confirmation.`,
      },
    });

    if (gateway === 'free') {
      return NextResponse.redirect(new URL('/student/subscriptions', req.url), 303);
    }

    const commission = price * (settings.platformCommission / 100);
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total: price,
        currency: pricing.currency,
        status: 'PENDING',
        gateway,
        invoiceNumber: `SUB-${Date.now()}`,
        items: {
          create: {
            courseId: `subscription:${plan.id}`,
            title: `${plan.name} membership access (${plan.interval})`,
            price,
            commission,
            instructorEarning: price - commission,
          },
        },
        payment: {
          create: {
            gateway,
            status: 'PENDING',
            metadata: await paymentMetadataWithAffiliate({
              subscriptionId: subscription.id,
              subscriptionPlanId: plan.id,
              subscriptionPlanName: plan.name,
              subscriptionInterval: plan.interval,
              subscriptionBillingMode: 'one_time_membership_access',
              baseSubtotal: basePrice,
              subtotal: pricing.subtotal,
              discount: pricing.discount,
              tax: pricing.tax,
              taxPercent: pricing.taxPercent,
              taxRates: pricing.taxRates,
              exchangeRate: pricing.exchangeRate,
            }, req.cookies.get('affiliate_ref')?.value, user.id),
          },
        },
      },
    });

    const session = await createGatewaySession(order.id, gateway, appUrlFromRequest(req));
    return NextResponse.redirect(session.redirectUrl, 303);
  } catch (error: any) {
    return handleRouteError(error, req);
  }
}
