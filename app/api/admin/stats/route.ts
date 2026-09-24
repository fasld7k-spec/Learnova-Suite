import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAdminReportData } from '@/app/admin/reports/report-data';

export async function GET() {
  try {
    await requireUser(['ADMIN']);
    const [users, courses, orders, pendingWithdrawals, reports] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.order.count(),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      getAdminReportData()
    ]);

    return ok({
      users,
      courses,
      orders,
      pendingWithdrawals,
      reports
    });
  } catch (e) {
    return handleError(e);
  }
}
