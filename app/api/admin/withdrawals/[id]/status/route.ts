import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const allowedStatuses = new Set(['PENDING', 'APPROVED', 'REJECTED', 'PAID']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireUser(['ADMIN']);
    const { id } = await params;
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const status = String(form.get('status') || '').toUpperCase();
    const payoutReference = String(form.get('payoutReference') || '').trim();
    const adminNote = String(form.get('adminNote') || '').trim();

    if (!allowedStatuses.has(status)) return fail('Invalid withdrawal status.', 422);
    const current = await prisma.withdrawal.findUnique({ where: { id }, include: { instructor: { select: { id: true, name: true } } } });
    if (!current) return fail('Withdrawal request not found.', 404);
    if (current.status === 'PAID' && status !== 'PAID') return fail('Paid withdrawals cannot be moved backward. Create an audit note instead.', 409);
    if (status === 'PAID' && current.status === 'REJECTED') return fail('Rejected withdrawals cannot be marked paid. Move it to approved first if needed.', 409);

    const withdrawal = await prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawal.update({ where: { id }, data: { status } });
      if (status !== current.status && status !== 'PENDING') {
        await tx.notification.create({
          data: {
            userId: current.instructorId,
            title: status === 'APPROVED' ? 'Withdrawal approved' : status === 'PAID' ? 'Withdrawal paid' : 'Withdrawal rejected',
            body: status === 'PAID'
              ? `Your withdrawal of ${String(current.amount)} has been marked as paid.`
              : status === 'APPROVED'
                ? `Your withdrawal of ${String(current.amount)} has been approved.`
                : `Your withdrawal of ${String(current.amount)} has been rejected.`,
          },
        });
      }
      return updated;
    });
    await audit({
      actorId: admin.id,
      action: 'withdrawal.status.update',
      entity: 'withdrawal',
      entityId: withdrawal.id,
      metadata: {
        from: current.status,
        to: status,
        instructorId: withdrawal.instructorId,
        instructorName: current.instructor.name,
        amount: String(withdrawal.amount),
        payoutReference,
        adminNote,
      },
    });
    return NextResponse.redirect(new URL('/admin/withdrawals?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message, 500);
  }
}
