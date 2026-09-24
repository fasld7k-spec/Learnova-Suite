import { AlertTriangle, Banknote, BookOpenCheck, GraduationCap, Headphones, ShieldCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/dashboard/Badge';

export default async function MarketplaceHealth() {
  await requireUser(['ADMIN']);
  const [
    pendingCourses,
    pendingInstructors,
    pendingWithdrawals,
    openSupport,
    failedPayments,
    publishedCourses,
    paidOrders,
    recentSupportTickets,
    failedPaymentRows,
  ] = await Promise.all([
    prisma.course.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { role: 'INSTRUCTOR', status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.payment.count({ where: { status: 'FAILED' } }),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.supportTicket.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 4 }),
    prisma.payment.findMany({ where: { status: 'FAILED' }, orderBy: { createdAt: 'desc' }, take: 4, include: { order: true } }),
  ]);

  const queueItems = [
    { label: 'Course review queue', value: pendingCourses, href: '/admin/courses', icon: BookOpenCheck },
    { label: 'Instructor approvals', value: pendingInstructors, href: '/admin/instructors', icon: GraduationCap },
    { label: 'Withdrawal approvals', value: pendingWithdrawals, href: '/admin/withdrawals', icon: Banknote },
    { label: 'Open support tickets', value: openSupport, href: '/admin/support', icon: Headphones },
    { label: 'Failed payment checks', value: failedPayments, href: '/admin/orders', icon: AlertTriangle },
  ];

  const activeAlerts = queueItems.filter((item) => item.value > 0).length;

  return (
    <DashboardShell role="admin" title="Marketplace Health">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Published Courses" value={publishedCourses} icon={<BookOpenCheck size={18} />} />
        <StatCard label="Paid Orders" value={paidOrders} icon={<Banknote size={18} />} />
        <StatCard label="Active Queues" value={activeAlerts} icon={<AlertTriangle size={18} />} />
        <StatCard label="Health Status" value={activeAlerts ? 'Review' : 'Clear'} icon={<ShieldCheck size={18} />} />
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="border border-[#2F3336] bg-black">
          <div className="border-b border-[#2F3336] p-5">
            <h2 className="text-xl font-black text-white">Operational queues</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">Use this board to clear the daily items that can block marketplace quality, revenue, or support response.</p>
          </div>
          <div className="divide-y divide-[#2F3336]">
            {queueItems.map((item) => {
              const Icon = item.icon;
              return (
                <a className="flex items-center justify-between gap-4 p-5 transition hover:bg-[#16181C]" href={item.href} key={item.label}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-[#2F3336] text-[#1D9BF0]">
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block font-black text-white">{item.label}</span>
                      <span className="mt-1 block text-sm text-[#71767B]">{item.value ? 'Needs admin review' : 'No pending items'}</span>
                    </span>
                  </span>
                  <Badge tone={item.value ? 'yellow' : 'green'}>{item.value}</Badge>
                </a>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="border border-[#2F3336] bg-black p-5">
            <h2 className="text-xl font-black text-white">Support pulse</h2>
            <div className="mt-4 grid gap-3">
              {recentSupportTickets.length ? recentSupportTickets.map((ticket) => (
                <div className="border border-[#2F3336] p-4" key={ticket.id}>
                  <p className="line-clamp-1 font-black text-white">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-[#71767B]">{ticket.email} / {ticket.createdAt.toLocaleDateString()}</p>
                </div>
              )) : <p className="text-sm text-[#71767B]">No open tickets right now.</p>}
            </div>
          </div>

          <div className="border border-[#2F3336] bg-black p-5">
            <h2 className="text-xl font-black text-white">Payment exceptions</h2>
            <div className="mt-4 grid gap-3">
              {failedPaymentRows.length ? failedPaymentRows.map((payment) => (
                <div className="border border-[#2F3336] p-4" key={payment.id}>
                  <p className="font-black text-white">{payment.order.invoiceNumber}</p>
                  <p className="mt-1 text-sm text-[#71767B]">{payment.gateway} / {payment.createdAt.toLocaleDateString()}</p>
                </div>
              )) : <p className="text-sm text-[#71767B]">No failed payments found.</p>}
            </div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
