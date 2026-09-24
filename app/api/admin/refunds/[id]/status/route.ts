import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { dispatchEmail } from '@/lib/email';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { refundGatewayPayment, type RefundPaymentOutcome } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const allowedStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireUser(['ADMIN']);
    const { id } = await params;
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const status = String(form.get('status') || '').trim().toUpperCase();
    if (!allowedStatuses.has(status)) return fail('Unsupported refund status.', 422);

    const existing = await prisma.refundRequest.findUnique({ where: { id } });
    if (!existing) return fail('Refund request not found.', 404);

    const order = await prisma.order.findUnique({
      where: { id: existing.orderId },
      include: { items: true, payment: true },
    });
    if (!order) return fail('Refund order not found.', 404);

    const user = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { id: true, name: true, email: true, locale: true },
    });

    let refundOutcome: RefundPaymentOutcome | null = null;
    if (status === 'APPROVED' && existing.status !== 'APPROVED') {
      refundOutcome = await refundGatewayPayment(order);
      if (refundOutcome.mode !== 'provider') {
        console.warn('Refund approved for manual/offline processing', {
          refundId: existing.id,
          orderId: order.id,
          gateway: refundOutcome.gateway,
          mode: refundOutcome.mode,
          message: refundOutcome.message,
        });
      }
    }

    const refund = await prisma.$transaction(async (tx) => {
      const updated = await tx.refundRequest.update({ where: { id }, data: { status } });

      if (status === 'APPROVED' && existing.status !== 'APPROVED') {
        const paymentMetadata = fromJsonObject<Record<string, unknown>>(order.payment?.metadata);
        const refundReference = refundOutcome?.providerRefundId || order.payment?.transactionId || `manual-refund-${updated.id}`;
        await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
        await tx.couponRedemption.deleteMany({ where: { orderId: order.id } });
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: {
            status: 'REFUNDED',
            transactionId: refundReference,
            metadata: toJson({
              ...paymentMetadata,
              refund: {
                approvedBy: admin.id,
                approvedAt: new Date().toISOString(),
                mode: refundOutcome?.mode || 'manual',
                gateway: refundOutcome?.gateway || order.gateway,
                message: refundOutcome?.message || 'Refund approved by admin.',
                providerRefundId: refundOutcome?.providerRefundId,
                originalTransactionId: order.payment?.transactionId || undefined,
              },
            }),
          },
        });
      }

      if (user && status !== 'PENDING' && existing.status !== status) {
        await tx.notification.create({
          data: {
            userId: user.id,
            title: status === 'APPROVED' ? 'Refund approved' : 'Refund request rejected',
            body: status === 'APPROVED'
              ? refundOutcome?.mode === 'provider'
                ? `Your refund for invoice ${order.invoiceNumber} has been approved and sent to the payment provider.`
                : `Your refund for invoice ${order.invoiceNumber} has been approved for manual/offline processing.`
              : `Your refund request for invoice ${order.invoiceNumber} was rejected.`,
          },
        });
      }

      return updated;
    });

    if (user?.email && status === 'APPROVED' && existing.status !== 'APPROVED') {
      await dispatchEmail({
        to: user.email,
        templateKey: 'refund-approved',
        locale: user.locale,
        variables: {
          studentName: user.name,
          courseTitle: order.items.map((item) => item.title).join(', ') || order.invoiceNumber,
          amount: Number(order.total).toFixed(2),
          currency: order.currency,
          refundId: refund.id,
        },
      }).catch(() => null);
    }

    await audit({
      actorId: admin.id,
      action: 'refund.status.update',
      entity: 'refundRequest',
      entityId: refund.id,
      metadata: {
        from: existing.status,
        to: status,
        orderId: refund.orderId,
        invoiceNumber: order.invoiceNumber,
        userId: refund.userId,
        orderStatusUpdated: status === 'APPROVED' && existing.status !== 'APPROVED',
        refundMode: refundOutcome?.mode,
        refundGateway: refundOutcome?.gateway,
        refundMessage: refundOutcome?.message,
        providerRefundId: refundOutcome?.providerRefundId,
      },
    });

    return NextResponse.redirect(new URL('/admin/refunds?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Refund status could not be updated.', 500);
  }
}
