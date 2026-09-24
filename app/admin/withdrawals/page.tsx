import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

const money = (value: unknown) => Number(value || 0);
const statusTone = (status: string) => (status === 'PAID' || status === 'APPROVED' ? 'green' : status === 'PENDING' ? 'yellow' : 'red');

export default async function Withdrawals() {
  await requireUser(['ADMIN']);
  const [rows, settings] = await Promise.all([
    prisma.withdrawal.findMany({ include: { instructor: true }, orderBy: { createdAt: 'desc' } }),
    getSiteSettings()
  ]);
  const currency = (value: number) => formatMoney(value, settings.currency);
  const pending = rows.filter((withdrawal) => withdrawal.status === 'PENDING');
  const approved = rows.filter((withdrawal) => withdrawal.status === 'APPROVED');
  const paid = rows.filter((withdrawal) => withdrawal.status === 'PAID');

  return (
    <DashboardShell role="admin" title="Withdrawals">
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <StatCard label="Pending Requests" value={pending.length} />
        <StatCard label="Pending Amount" value={currency(pending.reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0))} />
        <StatCard label="Approved Amount" value={currency(approved.reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0))} />
        <StatCard label="Paid Amount" value={currency(paid.reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0))} />
      </div>

      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <h2 className="text-xl font-black">Payout review queue</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          Move instructor withdrawal requests through pending, approved, paid, or rejected states after checking the payout method and available earnings.
        </p>
      </section>

      <DataTable
        headers={['Instructor', 'Amount', 'Method', 'Status', 'Requested', 'Action']}
        rows={rows.map((withdrawal) => [
          withdrawal.instructor.name,
          currency(money(withdrawal.amount)),
          withdrawal.method,
          <Badge key="status" tone={statusTone(withdrawal.status)}>{withdrawal.status}</Badge>,
          withdrawal.createdAt.toISOString().slice(0, 10),
          <form key="action" action={`/api/admin/withdrawals/${withdrawal.id}/status`} method="post" className="grid min-w-[320px] gap-2">
            <select className="input min-w-[140px]" name="status" defaultValue={withdrawal.status}>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="PAID">PAID</option>
            </select>
            <input className="input" name="payoutReference" placeholder="Bank/transfer reference for audit" />
            <input className="input" name="adminNote" placeholder="Internal payout note" />
            <button className="btn-primary w-fit">Update</button>
          </form>
        ])}
      />
    </DashboardShell>
  );
}
