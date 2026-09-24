import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function PayoutMethods() {
  const user = await requireUser(['INSTRUCTOR']);
  const rows = await prisma.instructorPayoutMethod.findMany({ where: { instructorId: user.id }, orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="instructor" title="Payout Methods">
      <form className="card mb-6 grid gap-3" action="/api/instructor/payout-methods" method="post">
        <CsrfInput />
        <select className="input" name="method">
          <option>PayPal</option>
          <option>Bank Transfer</option>
          <option>Wise</option>
        </select>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" name="accountName" placeholder="Account holder name" />
          <input className="input" name="email" type="email" placeholder="PayPal or Wise email" />
          <input className="input" name="bankName" placeholder="Bank name" />
          <input className="input" name="accountNumber" placeholder="Account / IBAN" />
        </div>
        <button className="btn-primary w-fit">Save Method</button>
      </form>

      <DataTable
        headers={['Method', 'Details', 'Active', 'Created', 'Manage']}
        rows={rows.map((row) => {
          const details = fromJsonObject<Record<string, string>>(row.details);
          return [
          row.method,
          <div key="details" className="text-sm leading-6 text-[#E7E9EA]">
            <p>{details.accountName || 'No account name'}</p>
            <p className="text-[#71767B]">{details.email || details.bankName || 'No payout destination'}</p>
            {details.accountNumber ? <p className="font-mono text-xs text-[#71767B]">{details.accountNumber.slice(0, 4)}...{details.accountNumber.slice(-4)}</p> : null}
          </div>,
          <Badge key="a" tone={row.active ? 'green' : 'red'}>
            {row.active ? 'Default' : 'Saved'}
          </Badge>,
          row.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <details>
              <summary className="btn-secondary inline-flex cursor-pointer text-xs">Edit</summary>
              <form className="mt-2 grid gap-2 rounded-2xl border border-[#2F3336] bg-[#050505] p-3" action="/api/instructor/payout-methods" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={row.id} />
                <select className="input" name="method" defaultValue={row.method}>
                  <option>PayPal</option>
                  <option>Bank Transfer</option>
                  <option>Wise</option>
                </select>
                <input className="input" name="accountName" defaultValue={details.accountName || ''} placeholder="Account holder name" />
                <input className="input" name="email" type="email" defaultValue={details.email || ''} placeholder="PayPal or Wise email" />
                <input className="input" name="bankName" defaultValue={details.bankName || ''} placeholder="Bank name" />
                <input className="input" name="accountNumber" defaultValue={details.accountNumber || ''} placeholder="Account / IBAN" />
                <button className="btn-primary w-fit text-xs">Save changes</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              {!row.active ? (
                <form action="/api/instructor/payout-methods" method="post">
                  <CsrfInput />
                  <input type="hidden" name="_action" value="set-default" />
                  <input type="hidden" name="id" value={row.id} />
                  <button className="btn-secondary text-xs">Set default</button>
                </form>
              ) : null}
              <form action="/api/instructor/payout-methods" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
              </form>
            </div>
          </div>,
        ];
        })}
      />
    </DashboardShell>
  );
}
