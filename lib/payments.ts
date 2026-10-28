import { reserveCouponRedemption, validateCouponForCheckout } from '@/lib/coupons';
import { dispatchEmail, renderEmailTemplate, sendEmail } from '@/lib/email';
import { paymentMetadataWithAffiliate, recordAffiliateCommissionForPaidOrder } from '@/lib/affiliate';
import { dispatchAddonEvent } from '@/lib/addons';
import { dispatchAutomationEvent } from '@/lib/automation';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { ensureGatewayAvailable, normalizeGateway } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { resolveAppUrl } from '@/lib/app-url';
import { dispatchPlatformWebhook } from '@/lib/outbound-webhooks';
import { priceCheckoutLines, resolveCheckoutPricingContext } from '@/lib/order-pricing';
import { Prisma } from '@prisma/client';

export type Gateway =
  | 'stripe'
  | 'paypal'
  | 'razorpay'
  | 'paystack'
  | 'flutterwave'
  | 'mollie'
  | 'iyzico'
  | 'paymob'
  | 'tap'
  | 'hyperpay'
  | 'midtrans'
  | 'xendit'
  | 'sslcommerz'
  | 'manual'
  | 'bank_transfer'
  | 'cod'
  | 'free'
  | string;

function courseAmount(course: { isFree: boolean; salePrice: unknown; price: unknown }) {
  return course.isFree ? 0 : Number(course.salePrice ?? course.price ?? 0);
}

async function serializableOrderTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code !== 'P2034' || attempt === 2) throw error;
    }
  }
  throw new Error('Transaction could not be completed.');
}

export async function createOrderForCourse({
  userId,
  courseId,
  gateway = 'manual',
  couponCode,
  affiliateCode,
  taxCountry,
}: {
  userId: string;
  courseId: string;
  gateway?: Gateway;
  couponCode?: string;
  affiliateCode?: string;
  taxCountry?: string;
}) {
  const settings = await getSiteSettings();
  const pricingContext = await resolveCheckoutPricingContext(settings.currency, taxCountry);
  const course = await prisma.course.findFirst({ where: { id: courseId, status: 'PUBLISHED' } });
  if (!course) throw new Error('Course not found');

  const baseSubtotal = courseAmount(course);
  const convertedLines = [{ courseId: course.id, amount: Math.round(baseSubtotal * pricingContext.exchangeRate * 100) / 100 }];
  const order = await serializableOrderTransaction(async (tx) => {
    const coupon = await validateCouponForCheckout({
      code: couponCode,
      userId,
      lines: convertedLines,
      db: tx,
    });
    const discount = coupon.valid ? coupon.discount : 0;
    const pricing = priceCheckoutLines({
      lines: [{ courseId: course.id, amount: baseSubtotal }],
      discount,
      context: pricingContext,
    });
    const total = pricing.total;
    const selected = total === 0 ? 'free' : normalizeGateway(gateway);
    if (selected !== 'free') await ensureGatewayAvailable(selected);

    const itemTotal = pricing.lines[0]?.total || 0;
    // Commission and instructor earnings are based on the price net of tax; tax is not instructor revenue.
    const itemNet = itemTotal - (pricing.lines[0]?.tax || 0);
    const commission = itemNet * (settings.platformCommission / 100);
    const created = await tx.order.create({
      data: {
        userId,
        total,
        currency: pricing.currency,
        status: 'PENDING',
        gateway: selected,
        invoiceNumber: `INV-${Date.now()}`,
        items: {
          create: {
            courseId,
            title: course.title,
            price: itemTotal,
            commission,
            instructorEarning: itemNet - commission,
          },
        },
        payment: {
          create: {
            gateway: selected,
            status: 'PENDING',
            metadata: await paymentMetadataWithAffiliate({
              baseSubtotal,
              subtotal: pricing.subtotal,
              discount: pricing.discount,
              tax: pricing.tax,
              taxPercent: pricing.taxPercent,
              taxRates: pricing.taxRates,
              exchangeRate: pricing.exchangeRate,
              couponCode: coupon.valid ? coupon.code : couponCode,
              couponId: coupon.couponId,
              couponRejectedReason: couponCode && !coupon.valid ? coupon.reason : undefined,
            }, affiliateCode, userId),
          },
        },
      },
    });
    await reserveCouponRedemption({ couponId: coupon.couponId, userId, orderId: created.id, db: tx });
    return created;
  });

  if (Number(order.total || 0) === 0) await markOrderPaid(order.id, 'free-course-checkout');
  return order;
}

export async function createOrderForDonation({
  userId,
  campaignId,
  amount,
  gateway = 'manual',
  donorName,
  message,
  affiliateCode,
}: {
  userId: string;
  campaignId: string;
  amount: number;
  gateway?: Gateway;
  donorName?: string;
  message?: string;
  affiliateCode?: string;
}) {
  const settings = await getSiteSettings();
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Donation amount must be greater than zero.');

  const campaign = await prisma.donationCampaign.findFirst({ where: { id: campaignId, active: true } });
  if (!campaign) throw new Error('Donation campaign not found.');

  const selected = normalizeGateway(gateway);
  await ensureGatewayAvailable(selected);

  const donation = await prisma.donation.create({
    data: {
      campaignId: campaign.id,
      donorName: donorName?.trim() || null,
      amount,
      message: message?.trim() || null,
    },
  });

  return prisma.order.create({
    data: {
      userId,
      total: amount,
      currency: settings.currency,
      status: 'PENDING',
      gateway: selected,
      invoiceNumber: `DON-${Date.now()}`,
      items: {
        create: {
          courseId: `donation:${donation.id}`,
          title: `Donation: ${campaign.title}`,
          price: amount,
          commission: 0,
          instructorEarning: 0,
        },
      },
      payment: {
        create: {
          gateway: selected,
          status: 'PENDING',
          metadata: await paymentMetadataWithAffiliate({
            donationId: donation.id,
            donationCampaignId: campaign.id,
            donationCampaignTitle: campaign.title,
          }, affiliateCode, userId),
        },
      },
    },
  });
}

export async function markOrderPaid(orderId: string, transactionId?: string) {
  const settings = await getSiteSettings();
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!existingOrder) throw new Error('Order not found');
  if (existingOrder.status === 'PAID') {
    if (transactionId && !existingOrder.payment?.transactionId) {
      await prisma.payment.update({
        where: { orderId },
        data: { transactionId, status: 'PAID' },
      }).catch(() => null);
    }
    return existingOrder;
  }

  // Conditional update: when two confirmations race (e.g. webhook + redirect capture), only the
  // one that flips the status runs the side effects below (enrollment, affiliate, coupons, emails).
  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: { not: 'PAID' } },
    data: { status: 'PAID' },
  });
  if (claimed.count === 0) {
    return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payment: true } });
  }
  await prisma.payment.updateMany({
    where: { orderId },
    data: { status: 'PAID', ...(transactionId ? { transactionId } : {}) },
  });
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payment: true } });
  const user = await prisma.user.findUnique({ where: { id: order.userId } });

  const metadata = fromJsonObject<{ couponId?: string; subscriptionId?: string }>(order.payment?.metadata);
  if (metadata.subscriptionId) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: String(metadata.subscriptionId) },
      include: { plan: true },
    }).catch(() => null);
    if (subscription) {
      const startsAt = subscription.startsAt > new Date() ? subscription.startsAt : new Date();
      const endsAt = new Date(startsAt);
      endsAt.setMonth(endsAt.getMonth() + (subscription.plan.interval === 'yearly' ? 12 : 1));
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'ACTIVE', startsAt, endsAt },
      }).catch(() => null);
      await prisma.notification.create({
        data: {
          userId: order.userId,
          title: 'Membership access activated',
          body: `${subscription.plan.name} access is active until ${endsAt.toLocaleDateString('en-US')}.`,
        },
      }).catch(() => null);
    }
  }
  if (metadata.couponId) {
    const existing = await prisma.couponRedemption.findFirst({
      where: { couponId: metadata.couponId, orderId: order.id, userId: order.userId },
    });
    if (!existing) {
      await prisma.couponRedemption
        .create({ data: { couponId: metadata.couponId, userId: order.userId, orderId: order.id } })
        .catch(() => null);
    }
  }

  await recordAffiliateCommissionForPaidOrder(order).catch(() => null);
  const appUrl = resolveAppUrl({ configured: settings.publicAppUrl });

  for (const item of order.items) {
    if (item.courseId.startsWith('subscription:') || item.courseId.startsWith('donation:')) continue;
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: order.userId, courseId: item.courseId } },
      update: {},
      create: { userId: order.userId, courseId: item.courseId },
    });

    // Req 9.6: send new-enrollment notification to instructor
    const course = await prisma.course.findUnique({
      where: { id: item.courseId },
      include: { instructor: { select: { name: true, email: true, locale: true } } },
    }).catch(() => null);
    if (course && user) {
      void dispatchEmail({
        to: course.instructor.email,
        templateKey: 'new-enrollment',
        variables: {
          instructorName: course.instructor.name,
          studentName: user.name,
          courseTitle: course.title,
          enrollmentsUrl: `${appUrl}/instructor/students`,
        },
        locale: course.instructor.locale,
      });
    }
  }

  await prisma.notification
    .create({ data: { userId: order.userId, title: 'Payment completed', body: `Your order ${order.invoiceNumber} is paid.` } })
    .catch(() => null);

  if (user) {
    const firstItem = order.items[0];
    const email = await renderEmailTemplate('purchase-confirmation', {
      studentName: user.name,
      courseTitle: firstItem?.title || 'your course',
      invoiceNumber: order.invoiceNumber,
      dashboardUrl: `${appUrl}/student/my-courses`
    }).catch(() => ({
      subject: `Your ${settings.siteName} order is confirmed`,
      html: `<h1>Payment completed</h1><p>Your order ${order.invoiceNumber} is paid and your courses are ready.</p>`
    }));
    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
    }).catch(() => null);
  }
  const eventPayload = {
    orderId: order.id,
    invoiceNumber: order.invoiceNumber,
    userId: order.userId,
    total: Number(order.total),
    currency: order.currency,
    gateway: order.gateway,
    transactionId: transactionId || order.payment?.transactionId || '',
    itemCount: order.items.length,
    courseIds: order.items.map((item) => item.courseId),
  };
  await Promise.allSettled([
    dispatchAddonEvent('order.paid', eventPayload),
    dispatchAutomationEvent('order.paid', {
      ...eventPayload,
      userEmail: user?.email,
      userName: user?.name,
    }),
    dispatchPlatformWebhook('order.paid', eventPayload),
  ]);
  return order;
}

export async function markOrderFailed(orderId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status: 'FAILED', payment: { update: { status: 'FAILED', metadata: toJson({ reason }) } } },
    });
    await tx.couponRedemption.deleteMany({ where: { orderId } });
    return order;
  });
}

/**
 * Removes the course access an order granted once it is refunded. Courses the
 * student also owns through another paid order are kept. A certificate issued
 * for a revoked enrollment is removed with it (it references the enrollment).
 */
export async function revokeRefundedOrderAccess(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { userId: true, items: { select: { courseId: true } } } });
  if (!order) return;
  const courseIds = order.items
    .map((item) => item.courseId)
    .filter((courseId) => !courseId.startsWith('subscription:') && !courseId.startsWith('donation:'));
  if (!courseIds.length) return;

  const stillOwned = await tx.orderItem.findMany({
    where: { courseId: { in: courseIds }, order: { userId: order.userId, status: 'PAID', id: { not: orderId } } },
    select: { courseId: true },
  });
  const owned = new Set(stillOwned.map((item) => item.courseId));
  const revoke = courseIds.filter((courseId) => !owned.has(courseId));
  if (!revoke.length) return;

  const enrollments = await tx.enrollment.findMany({
    where: { userId: order.userId, courseId: { in: revoke } },
    select: { id: true },
  });
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  if (!enrollmentIds.length) return;
  await tx.certificate.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } });
  await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } });
}

export async function refundOrder(orderId: string, transactionId?: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    const metadata = fromJsonObject<Record<string, unknown>>(existing?.payment?.metadata);
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED',
        payment: {
          update: {
            status: 'REFUNDED',
            transactionId,
            metadata: toJson({
              ...metadata,
              refund: {
                mode: 'provider',
                gateway: existing?.payment?.gateway || existing?.gateway,
                message: 'Refund received from provider webhook.',
                providerRefundId: transactionId,
              },
            }),
          },
        },
      },
    });
    await tx.couponRedemption.deleteMany({ where: { orderId } });
    await revokeRefundedOrderAccess(tx, orderId);
    return order;
  });
}
