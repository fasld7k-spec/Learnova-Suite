import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';
import { getAdminReportData } from './report-data';

function BarList({ rows, labelKey }: { rows: { label: string; value: number; meta: string }[]; labelKey: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={`${labelKey}-${row.label}`}>
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="font-bold text-white">{row.label}</span>
            <span className="text-[#71767B]">{row.meta}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#16181C]">
            <div className="h-full rounded-full bg-[#1D9BF0]" style={{ width: `${Math.max((row.value / max) * 100, 8)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function safeDate(value?: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function Reports(props: { searchParams?: Promise<{ from?: string; to?: string; status?: string; instructorId?: string; courseId?: string; categoryId?: string }> }) {
  await requireUser(['ADMIN']);
  const params = await props.searchParams;
  const filters = {
    from: safeDate(params?.from),
    to: safeDate(params?.to, true),
    status: params?.status || 'PAID',
    instructorId: params?.instructorId || null,
    courseId: params?.courseId || null,
    categoryId: params?.categoryId || null,
  };
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.status) query.set('status', params.status);
  if (params?.instructorId) query.set('instructorId', params.instructorId);
  if (params?.courseId) query.set('courseId', params.courseId);
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  const [report, settings, instructors, courses, categories] = await Promise.all([
    getAdminReportData(filters),
    getSiteSettings(),
    prisma.user.findMany({ where: { role: 'INSTRUCTOR' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.course.findMany({ select: { id: true, title: true, instructorId: true, categoryId: true }, orderBy: { title: 'asc' } }),
    prisma.category.findMany({ select: { id: true, nameEn: true }, orderBy: { nameEn: 'asc' } }),
  ]);
  const currency = (value: number) => formatMoney(value, settings.currency);

  return (
    <DashboardShell role="admin" title="Reports & Analytics">
      <div className="mb-6 flex flex-wrap gap-3">
        <a className="btn-primary" href={`/api/admin/reports/export${query.size ? `?${query.toString()}` : ''}`}>Export Reports CSV</a>
        <a className="btn-secondary" href="/admin/export">Export Center</a>
      </div>
      <form className="card mb-6 grid gap-3 md:grid-cols-4 xl:grid-cols-7" action="/admin/reports" method="get">
        <input className="input" type="date" name="from" defaultValue={params?.from || ''} aria-label="From date" />
        <input className="input" type="date" name="to" defaultValue={params?.to || ''} aria-label="To date" />
        <select className="input" name="status" defaultValue={filters.status}>
          <option value="PAID">Paid revenue</option>
          <option value="PENDING">Pending orders</option>
          <option value="FAILED">Failed orders</option>
          <option value="REFUNDED">Refunded orders</option>
        </select>
        <select className="input" name="instructorId" defaultValue={filters.instructorId || ''}>
          <option value="">All instructors</option>
          {instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}
        </select>
        <select className="input" name="courseId" defaultValue={filters.courseId || ''}>
          <option value="">All courses</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select className="input" name="categoryId" defaultValue={filters.categoryId || ''}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.nameEn}</option>)}
        </select>
        <button className="btn-primary">Filter reports</button>
      </form>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={currency(report.summary.revenue)} />
        <StatCard label="Paid Orders" value={report.summary.paidOrders} />
        <StatCard label="Enrollments" value={report.summary.enrollments} />
        <StatCard label="Completion" value={`${report.summary.completionRate}%`} />
        <StatCard label="Coupon Uses" value={report.summary.couponRedemptions} />
        <StatCard label="Active Students" value={report.summary.activeStudents} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="border border-[#2F3336] bg-black p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black">Daily sales</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge tone="blue">Last 14 days</Badge>
            </div>
          </div>
          <BarList
            labelKey="daily"
            rows={report.dailySales.map((row) => ({
              label: row.date,
              value: row.revenue,
              meta: `${currency(row.revenue)} / ${row.orders} orders`
            }))}
          />
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black">Monthly sales</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge tone="green">Revenue</Badge>
            </div>
          </div>
          <BarList
            labelKey="monthly"
            rows={report.monthlySales.map((row) => ({
              label: row.month,
              value: row.revenue,
              meta: `${currency(row.revenue)} / ${row.orders} orders`
            }))}
          />
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Top courses</h2>
          </div>
          <DataTable
            headers={['Course', 'Revenue', 'Sales', 'Enrollments', 'Completion']}
            rows={report.topCourses.map((course) => [
              course.title,
              currency(course.revenue),
              course.sales,
              course.enrollments,
              `${course.completionRate}%`
            ])}
          />
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Active students</h2>
          </div>
          <DataTable
            headers={['Student', 'Completed Lessons', 'Last Active']}
            rows={report.activeStudentRows.map((student) => [student.student, student.completedLessons, student.lastActive])}
          />
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Coupons</h2>
          </div>
          <DataTable
            headers={['Code', 'Discount', 'Status', 'Redemptions']}
            rows={report.couponUsage.map((coupon) => [
              coupon.code,
              coupon.discount,
              <Badge key={coupon.code} tone={coupon.active ? 'green' : 'slate'}>{coupon.active ? 'Active' : 'Paused'}</Badge>,
              coupon.redemptions
            ])}
          />
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Instructor earnings</h2>
          </div>
          <DataTable
            headers={['Instructor', 'Gross Revenue', 'Earnings', 'Paid Out', 'Available']}
            rows={report.instructorEarnings.map((row) => [
              row.instructor,
              currency(row.revenue),
              currency(row.earnings),
              currency(row.paidOut),
              currency(Math.max(row.earnings - row.paidOut, 0))
            ])}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
