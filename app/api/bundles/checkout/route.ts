import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { createGatewaySession, ensureGatewayAvailable, normalizeGateway } from '@/lib/payment-gateways';
import { markOrderPaid } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { paymentMetadataWithAffiliate } from '@/lib/affiliate';
import { appUrlFromRequest } from '@/lib/app-url';
import { verifyCsrf } from '@/lib/csrf';
import { featureEnabled } from '@/lib/features';
import { checkoutTaxCountry, priceCheckoutLines, resolveCheckoutPricingContext } from '@/lib/order-pricing';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    if (await featureEnabled('checkout_disabled')) return fail('Checkout is temporarily paused.', 503);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const settings = await getSiteSettings();
    const pricingContext = await resolveCheckoutPricingContext(settings.currency, checkoutTaxCountry(form.get('taxCountry'), req.headers));
    const bundleId = String(form.get('bundleId') || '');
    const gateway = normalizeGateway(String(form.get('gateway') || 'manual'));
    if (!bundleId) return fail('bundleId is required', 422);

    const bundle = await prisma.courseBundle.findFirst({ where: { id: bundleId, active: true } });
    if (!bundle) return fail('Bundle not found', 404);

    const courseIds = fromJsonArray<string>(bundle.courseIds);
    if (!courseIds.length) return fail('Bundle has no courses', 422);

    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds }, status: 'PUBLISHED' },
      include: { instructor: true }
    });
    if (!courses.length) return fail('Bundle courses are unavailable', 422);

    const basePrice = Number(bundle.price || 0);
    const pricing = priceCheckoutLines({ lines: [{ courseId: bundle.id, amount: basePrice }], context: pricingContext });
    const selectedGateway = pricing.total <= 0 ? 'free' : gateway;
    if (selectedGateway !== 'free') await ensureGatewayAvailable(selectedGateway);
    const itemPrice = courses.length ? pricing.total / courses.length : 0;
    // Commission and earnings exclude tax.
    const itemNet = courses.length ? (pricing.total - pricing.tax) / courses.length : 0;
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        total: pricing.total,
        currency: pricing.currency,
        status: 'PENDING',
        gateway: selectedGateway,
        invoiceNumber: `BND-${Date.now()}`,
        items: {
          create: courses.map((course) => ({
            courseId: course.id,
            title: `${bundle.title}: ${course.title}`,
            price: itemPrice,
            commission: itemNet * (settings.platformCommission / 100),
            instructorEarning: itemNet * (1 - settings.platformCommission / 100)
          }))
        },
        payment: {
          create: {
            gateway: selectedGateway,
            status: 'PENDING',
            metadata: await paymentMetadataWithAffiliate({
              bundleId: bundle.id,
              bundleTitle: bundle.title,
              baseSubtotal: basePrice,
              subtotal: pricing.subtotal,
              discount: pricing.discount,
              tax: pricing.tax,
              taxPercent: pricing.taxPercent,
              taxRates: pricing.taxRates,
              exchangeRate: pricing.exchangeRate,
            }, req.cookies.get('affiliate_ref')?.value, user.id)
          }
        }
      }
    });

    if (selectedGateway === 'free') await markOrderPaid(order.id, 'free-bundle-checkout');
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Bundle order created',
        body: selectedGateway === 'free' ? `${bundle.title} is ready in your learning dashboard.` : `${bundle.title} order was created and is waiting for payment confirmation.`
      }
    });

    const session = await createGatewaySession(order.id, selectedGateway, appUrlFromRequest(req));
    return NextResponse.redirect(session.redirectUrl, 303);
  } catch (e: any) {
    return handleRouteError(e, req);
  }
}
