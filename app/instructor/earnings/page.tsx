import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const currency = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const money = (value: unknown) => Number(value || 0);

export default async function Earnings(props: { searchParams?: Promise<{ withdrawalError?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['INSTRUCTOR']);
  const courses = await prisma.course.findMany({ where: { instructorId: user.id }, select: { id: true, title: true } });
  const courseIds = courses.map((course) => course.id);
  const [items, withdrawals, payoutMethods] = await Promise.all([
    courseIds.length
      ? prisma.orderItem.findMany({
          where: { courseId: { in: courseIds }, order: { status: 'PAID' } },
          include: { order: { select: { invoiceNumber: true, createdAt: true } } },
          orderBy: { order: { createdAt: 'desc' } },
          take: 100
        })
      : Promise.resolve([]),
    prisma.withdrawal.findMany({ where: { instructorId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 })
    ,prisma.instructorPayoutMethod.findMany({ where: { instructorId: user.id, active: true }, orderBy: { createdAt: 'desc' } })
  ]);

  const grossRevenue = items.reduce((sum, item) => sum + money(item.price), 0);
  const totalEarnings = items.reduce((sum, item) => sum + money(item.instructorEarning), 0);
  const paidOut = withdrawals.filter((withdrawal) => ['APPROVED', 'PAID'].includes(withdrawal.status)).reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0);
  const pending = withdrawals.filter((withdrawal) => withdrawal.status === 'PENDING').reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0);

  const courseTotals = new Map<string, { title: string; sales: number; revenue: number; earnings: number }>();
  for (const course of courses) {
    courseTotals.set(course.id, { title: course.title, sales: 0, revenue: 0, earnings: 0 });
  }
  for (const item of items) {
    const current = courseTotals.get(item.courseId) ?? { title: item.title, sales: 0, revenue: 0, earnings: 0 };
    current.sales += 1;
    current.revenue += money(item.price);
    current.earnings += money(item.instructorEarning);
    courseTotals.set(item.courseId, current);
  }

  const courseRows = [...courseTotals.values()].filter((row) => row.sales).sort((a, b) => b.earnings - a.earnings);
  const displayItems = items.slice(0, 8).map((item) => ({
    invoice: item.order.invoiceNumber,
    course: item.title,
    date: item.order.createdAt.toISOString().slice(0, 10),
    price: money(item.price),
    earnings: money(item.instructorEarning)
  }));

  return (
    <DashboardShell role="instructor" title="Earnings">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Gross Revenue" value={currency(grossRevenue)} />
        <StatCard label="Instructor Earnings" value={currency(totalEarnings)} />
        <StatCard label="Approved/Paid Out" value={currency(paidOut)} />
        <StatCard label="Available" value={currency(Math.max(totalEarnings - paidOut - pending, 0))} />
      </div>
      {!items.length ? (
        <div className="mt-4 border border-[#2F3336] bg-black p-4 text-sm font-bold text-[#E7E9EA]">
          No paid order revenue is recorded for this instructor yet.
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-4 text-xl font-black">Course earnings</h2>
          <DataTable
            headers={['Course', 'Sales', 'Gross Revenue', 'Your Earnings']}
            rows={courseRows.map((row) => [
              row.title,
              row.sales,
              currency(row.revenue),
              currency(row.earnings)
            ])}
          />
        </section>

        <section className="border border-[#2F3336] bg-black p-5">
          <h2 className="text-xl font-black">Withdrawal request</h2>
          <p className="mt-2 text-sm text-[#71767B]">Pending requests are counted before available balance is shown.</p>
          {searchParams?.withdrawalError && (
            <div className="mt-4 border border-[#F4212E] bg-black p-3 text-sm font-bold text-[#F4212E]">
              {searchParams.withdrawalError}
            </div>
          )}
          <form className="mt-6 grid gap-3" action="/api/instructor/withdrawals" method="post">
            <CsrfInput />
            <input className="input" name="amount" type="number" min="1" placeholder="Amount" />
            <select className="input" name="methodId" required>
              <option value="">Select payout method</option>
              {payoutMethods.map((method) => (
                <option key={method.id} value={method.id}>{method.method}</option>
              ))}
            </select>
            <a className="btn-secondary text-center" href="/instructor/payout-methods">Manage payout methods</a>
            <button className="btn-primary" disabled={!payoutMethods.length}>Request Withdrawal</button>
          </form>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-4 text-xl font-black">Recent earning events</h2>
          <DataTable
            headers={['Invoice', 'Course', 'Date', 'Sale', 'Earning']}
            rows={displayItems.map((item) => [
              item.invoice,
              item.course,
              item.date,
              currency(item.price),
              currency(item.earnings)
            ])}
          />
        </section>

        <section>
          <h2 className="mb-4 text-xl font-black">Withdrawals</h2>
          <DataTable
            headers={['Amount', 'Method', 'Status', 'Date']}
            rows={(withdrawals.length ? withdrawals : []).map((withdrawal) => [
              currency(money(withdrawal.amount)),
              withdrawal.method,
              <Badge key={withdrawal.id} tone={withdrawal.status === 'APPROVED' ? 'green' : withdrawal.status === 'PENDING' ? 'yellow' : 'red'}>{withdrawal.status}</Badge>,
              withdrawal.createdAt.toISOString().slice(0, 10)
            ])}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
