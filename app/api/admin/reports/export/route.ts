import { NextRequest } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { getAdminReportData } from '@/app/admin/reports/report-data';

function safeDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const report = await getAdminReportData({
      from: safeDate(req.nextUrl.searchParams.get('from')),
      to: safeDate(req.nextUrl.searchParams.get('to'), true),
      status: req.nextUrl.searchParams.get('status') || 'PAID',
      instructorId: req.nextUrl.searchParams.get('instructorId'),
      courseId: req.nextUrl.searchParams.get('courseId'),
      categoryId: req.nextUrl.searchParams.get('categoryId'),
    });
    const sourceFor = (section: string) => (report.demoData.sections.includes(section) ? report.demoData.sourceLabel : 'Database');
    const rows: (string | number | null | undefined)[][] = [
      ['Summary', 'Revenue', report.summary.revenue, undefined, undefined, undefined, 'Database'],
      ['Summary', 'Paid Orders', report.summary.paidOrders, undefined, undefined, undefined, 'Database'],
      ['Summary', 'Enrollments', report.summary.enrollments, undefined, undefined, undefined, 'Database'],
      ['Summary', 'Completion Rate', `${report.summary.completionRate}%`, undefined, undefined, undefined, 'Database'],
      ['Summary', 'Coupon Redemptions', report.summary.couponRedemptions, undefined, undefined, undefined, 'Database'],
      ['Summary', 'Active Students', report.summary.activeStudents, undefined, undefined, undefined, 'Database'],
      ...report.dailySales.map((row) => ['Daily Sales', row.date, row.revenue, row.orders, undefined, undefined, sourceFor('Daily sales')]),
      ...report.monthlySales.map((row) => ['Monthly Sales', row.month, row.revenue, row.orders, undefined, undefined, sourceFor('Monthly sales')]),
      ...report.topCourses.map((row) => ['Top Course', row.title, row.revenue, row.sales, row.enrollments, `${row.completionRate}%`, sourceFor('Top courses')]),
      ...report.activeStudentRows.map((row) => ['Active Student', row.student, row.completedLessons, row.lastActive, undefined, undefined, sourceFor('Active students')]),
      ...report.couponUsage.map((row) => ['Coupon', row.code, row.discount, row.active ? 'Active' : 'Paused', row.redemptions, undefined, sourceFor('Coupons')]),
      ...report.instructorEarnings.map((row) => ['Instructor Earnings', row.instructor, row.revenue, row.earnings, row.paidOut, Math.max(row.earnings - row.paidOut, 0), sourceFor('Instructor earnings')]),
    ];
    await audit({ actorId: admin.id, action: 'reports.export', entity: 'report', metadata: { rows: rows.length, demoDataSections: report.demoData.sections } });
    return csvResponse(`reports-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Section', 'Label', 'Value A', 'Value B', 'Value C', 'Value D', 'Data Source'], rows));
  } catch (error: any) {
    return fail(error.message || 'Reports export failed.', 500);
  }
}
