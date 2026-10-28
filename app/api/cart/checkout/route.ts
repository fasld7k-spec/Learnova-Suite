import { fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { reserveCouponRedemption, validateCouponForCheckout } from '@/lib/coupons';
import { createGatewaySession, ensureGatewayAvailable, normalizeGateway } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { markOrderPaid } from '@/lib/payments';
import { getSiteSettings } from '@/lib/site-settings';
import { paymentMetadataWithAffiliate } from '@/lib/affiliate';
import { appUrlFromRequest } from '@/lib/app-url';
import { verifyCsrf } from '@/lib/csrf';
import { featureEnabled } from '@/lib/features';
import { checkoutTaxCountry, priceCheckoutLines, resolveCheckoutPricingContext } from '@/lib/order-pricing';
import { Prisma } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    if (await featureEnabled('checkout_disabled')) return fail('Checkout is temporarily paused.', 503);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const settings = await getSiteSettings();
    const taxCountry = checkoutTaxCountry(form.get('taxCountry'), req.headers);
    const pricingContext = await resolveCheckoutPricingContext(settings.currency, taxCountry);
    const gateway = normalizeGateway(String(form.get('gateway') || 'manual'));
    const couponCode = String(form.get('couponCode') || '').trim().toUpperCase();
    const cart = await prisma.cart.findUnique({ where: { userId: user.id }, include: { items: true } });

    if (!cart || cart.items.length === 0) return fail('Cart is empty', 422);

    const courses = await prisma.course.findMany({ where: { id: { in: cart.items.map((item) => item.courseId) }, status: 'PUBLISHED' } });
    if (!courses.length || courses.length !== cart.items.length) return fail('Cart courses are no longer available.', 422);

    const baseLines = courses.map((course) => ({ courseId: course.id, amount: course.isFree ? 0 : Number(course.salePrice ?? course.price ?? 0) }));
    const convertedLines = baseLines.map((line) => ({ ...line, amount: Math.round(line.amount * pricingContext.exchangeRate * 100) / 100 }));
    const coupon = await validateCouponForCheckout({ code: couponCode, userId: user.id, lines: convertedLines });
    if (couponCode && !coupon.valid) {
      const url = new URL('/cart', req.url);
      url.searchParams.set('coupon', couponCode);
      return NextResponse.redirect(url, 303);
    }
    const discount = coupon.valid ? coupon.discount : 0;
    const pricingPreview = priceCheckoutLines({ lines: baseLines, discount, context: pricingContext });
    const selectedGateway = pricingPreview.total === 0 ? 'free' : gateway;
    if (selectedGateway !== 'free') await ensureGatewayAvailable(selectedGateway);
    const order = await prisma.$transaction(async (tx) => {
      const currentCoupon = await validateCouponForCheckout({ code: couponCode, userId: user.id, lines: convertedLines, db: tx });
      if (couponCode && !currentCoupon.valid) throw new Error(currentCoupon.reason || 'Coupon is no longer available.');
      const currentDiscount = currentCoupon.valid ? currentCoupon.discount : 0;
      const currentPricing = priceCheckoutLines({ lines: baseLines, discount: currentDiscount, context: pricingContext });
      const currentLineByCourse = new Map(currentPricing.lines.map((line) => [line.courseId, line]));
      const currentSelectedGateway = currentPricing.total === 0 ? 'free' : selectedGateway;
      const created = await tx.order.create({
        data: {
          userId: user.id,
          total: currentPricing.total,
          currency: currentPricing.currency,
          status: 'PENDING',
          gateway: currentSelectedGateway,
          invoiceNumber: `CART-${Date.now()}`,
          items: {
            create: courses.map((course) => {
              const line = currentLineByCourse.get(course.id);
              const price = line?.total || 0;
              // Commission and earnings exclude tax.
              const net = price - (line?.tax || 0);
              const commission = net * (settings.platformCommission / 100);
              return { courseId: course.id, title: course.title, price, commission, instructorEarning: net - commission };
            }),
          },
          payment: {
            create: {
              gateway: currentSelectedGateway,
              status: 'PENDING',
              metadata: await paymentMetadataWithAffiliate({
                baseSubtotal: baseLines.reduce((amount, line) => amount + line.amount, 0),
                subtotal: currentPricing.subtotal,
                discount: currentPricing.discount,
                tax: currentPricing.tax,
                taxPercent: currentPricing.taxPercent,
                taxRates: currentPricing.taxRates,
                exchangeRate: currentPricing.exchangeRate,
                couponCode: currentCoupon.valid ? currentCoupon.code : couponCode || undefined,
                couponId: currentCoupon.couponId,
                couponRejectedReason: couponCode && !currentCoupon.valid ? currentCoupon.reason : undefined,
              }, req.cookies.get('affiliate_ref')?.value, user.id),
            },
          },
        },
      });
      await reserveCouponRedemption({ couponId: currentCoupon.couponId, userId: user.id, orderId: created.id, db: tx });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (Number(order.total || 0) === 0) await markOrderPaid(order.id, 'free-cart-checkout');
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    const session = await createGatewaySession(order.id, order.gateway, appUrlFromRequest(req));
    return NextResponse.redirect(session.redirectUrl, 303);
  } catch (error) {
    return handleError(error);
  }
}
