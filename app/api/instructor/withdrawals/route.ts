import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';
import { fromJsonObject } from '@/lib/json-fields';
import { verifyCsrf } from '@/lib/csrf';

const money = (value: unknown) => Number(value || 0);

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/instructor/earnings', req.url);
  url.searchParams.set('withdrawalError', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const amount = Number(form.get('amount'));
    const methodId = String(form.get('methodId') || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) return formError(req, 'Enter a valid withdrawal amount.');
    if (!methodId) return formError(req, 'Select a saved payout method.');

    const payoutMethod = await prisma.instructorPayoutMethod.findFirst({
      where: { id: methodId, instructorId: user.id, active: true },
    });
    if (!payoutMethod) return formError(req, 'Select an active payout method from your saved payout methods.');
    const details = fromJsonObject<Record<string, string>>(payoutMethod.details);
    const methodLabel = `${payoutMethod.method}${details.accountName ? ` - ${details.accountName}` : ''}`;

    const courses = await prisma.course.findMany({ where: { instructorId: user.id }, select: { id: true } });
    const courseIds = courses.map((course) => course.id);
    const [items, withdrawals, settings] = await Promise.all([
      courseIds.length
        ? prisma.orderItem.findMany({
            where: { courseId: { in: courseIds }, order: { status: 'PAID' } },
            select: { instructorEarning: true }
          })
        : Promise.resolve([]),
      prisma.withdrawal.findMany({ where: { instructorId: user.id }, select: { amount: true, status: true } }),
      getSiteSettings()
    ]);

    const totalEarnings = items.reduce((sum, item) => sum + money(item.instructorEarning), 0);
    const reserved = withdrawals
      .filter((withdrawal) => withdrawal.status === 'PENDING' || withdrawal.status === 'APPROVED' || withdrawal.status === 'PAID')
      .reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0);
    const available = Math.max(totalEarnings - reserved, 0);

    if (amount > available) return formError(req, `Withdrawal exceeds available balance of ${formatMoney(available, settings.currency)}.`);

    await prisma.withdrawal.create({ data: { instructorId: user.id, amount, method: methodLabel } });
    return NextResponse.redirect(new URL('/instructor/earnings', req.url), 303);
  } catch (error: any) {
    return formError(req, error.message || 'Unable to request withdrawal.', 500);
  }
}
