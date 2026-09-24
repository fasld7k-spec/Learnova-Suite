import Link from 'next/link';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

const money = (value: unknown) => Number(value || 0);

export default async function Admin() {
  await requireUser(['ADMIN']);

  const [
    users,
    courses,
    orders,
    paidOrders,
    pendingInstructors,
    pendingCourses,
    pendingWithdrawals,
    pendingReviews,
    failedPayments,
    recentOrders,
    recentWithdrawals,
    settings
  ] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.order.count(),
    prisma.order.findMany({ where: { status: 'PAID' }, select: { total: true } }),
    prisma.user.count({ where: { role: 'INSTRUCTOR', status: 'PENDING' } }),
    prisma.course.count({ where: { status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.review.count(),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.withdrawal.findMany({
      include: { instructor: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    getSiteSettings()
  ]);

  const revenue = paidOrders.reduce((sum, order) => sum + money(order.total), 0);
  const currency = (value: number) => formatMoney(value, settings.currency);
  const customers = recentOrders.length
    ? await prisma.user.findMany({
        where: { id: { in: [...new Set(recentOrders.map((order) => order.userId))] } },
        select: { id: true, name: true }
      })
    : [];
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));

  return (
    <DashboardShell role="admin" title="Admin Dashboard">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={currency(revenue)} />
        <StatCard label="Orders" value={orders} />
        <StatCard label="Users" value={users} />
        <StatCard label="Courses" value={courses} />
        <StatCard label="Pending Instructors" value={pendingInstructors} />
        <StatCard label="Pending Withdrawals" value={pendingWithdrawals} />
      </div>

      <section className="moe-panel mt-8 rounded-xl p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Admin operations</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Marketplace Control Center</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-400">
              Review approvals, orders, payments, reviews, withdrawals and settings from one compact command view.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="moe-primary inline-flex h-10 items-center rounded-lg px-4 text-sm font-black transition" href="/admin/orders">Orders</Link>
              <Link className="moe-control inline-flex h-10 items-center rounded-lg px-4 text-sm font-black text-white transition hover:bg-white/10" href="/admin/withdrawals">Withdrawals</Link>
              <Link className="moe-control inline-flex h-10 items-center rounded-lg px-4 text-sm font-black text-white transition hover:bg-white/10" href="/admin/settings">Settings</Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="moe-panel-soft rounded-xl p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Course approvals</p>
              <p className="mt-2 text-2xl font-black text-white">{pendingCourses}</p>
            </div>
            <div className="moe-panel-soft rounded-xl p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Reviews in catalog</p>
              <p className="mt-2 text-2xl font-black text-white">{pendingReviews}</p>
            </div>
            <div className="moe-panel-soft rounded-xl p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Failed payments</p>
              <p className="mt-2 text-2xl font-black text-white">{failedPayments}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-4 text-xl font-black text-white">Recent orders</h2>
          <DataTable
            headers={['Invoice', 'Customer', 'Amount', 'Status', 'Date']}
            rows={recentOrders.map((order) => [
              order.invoiceNumber,
              customerNames.get(order.userId) || 'Customer',
              currency(money(order.total)),
              <Badge key={order.id} tone={order.status === 'PAID' ? 'green' : order.status === 'PENDING' ? 'yellow' : 'red'}>{order.status}</Badge>,
              order.createdAt.toISOString().slice(0, 10)
            ])}
          />
        </section>

        <section>
          <h2 className="mb-4 text-xl font-black text-white">Withdrawal queue</h2>
          <DataTable
            headers={['Instructor', 'Amount', 'Method', 'Status', 'Date']}
            rows={recentWithdrawals.map((withdrawal) => [
              withdrawal.instructor.name,
              currency(money(withdrawal.amount)),
              withdrawal.method,
              <Badge key={withdrawal.id} tone={withdrawal.status === 'PAID' || withdrawal.status === 'APPROVED' ? 'green' : withdrawal.status === 'PENDING' ? 'yellow' : 'red'}>{withdrawal.status}</Badge>,
              withdrawal.createdAt.toISOString().slice(0, 10)
            ])}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
