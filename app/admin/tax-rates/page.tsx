import { BadgePercent, CircleDollarSign, Globe2, ReceiptText } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

function percent(value: unknown) {
  return Number(value || 0);
}

export default async function TaxRates() {
  await requireUser(['ADMIN']);
  const rates = await prisma.taxRate.findMany({ orderBy: { createdAt: 'desc' } });

  const active = rates.filter((rate) => rate.active).length;
  const countries = new Set(rates.map((rate) => rate.country)).size;
  const avgRate = rates.length ? rates.reduce((sum, rate) => sum + percent(rate.percent), 0) / rates.length : 0;
  const highRates = rates.filter((rate) => percent(rate.percent) >= 15).length;

  return (
    <DashboardShell role="admin" title="Tax Rates">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tax rates" value={rates.length} icon={<ReceiptText size={18} />} />
        <StatCard label="Active" value={active} icon={<CircleDollarSign size={18} />} />
        <StatCard label="Countries" value={countries} icon={<Globe2 size={18} />} />
        <StatCard label="Avg rate" value={`${avgRate.toFixed(1)}%`} icon={<BadgePercent size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/tax-rates" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Checkout compliance</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a tax rule</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Region-specific tax rates keep invoices, checkout totals and marketplace accounting ready for real commercial use.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="name" placeholder="VAT" required />
            <input className="input" name="country" placeholder="US/SA/AE or * for all countries" required />
            <input className="input" name="percent" type="number" min="0" step="0.01" placeholder="15" required />
          </div>
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Rate</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Finance readiness</p>
          <h3 className="mt-1 text-xl font-black text-white">Tax coverage</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Active jurisdictions</span>
              <Badge tone={active ? 'green' : 'yellow'}>{active}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Country spread</span>
              <Badge tone={countries >= 2 ? 'green' : 'yellow'}>{countries}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>High-rate rules</span>
              <Badge tone={highRates ? 'green' : 'slate'}>{highRates}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Rule', 'Country', 'Percent', 'Band', 'Status', 'Manage']}
          rows={rates.map((rate) => [
            <p key="rule" className="font-bold text-white">{rate.name}</p>,
            <code key="country" className="text-xs text-[#1D9BF0]">{rate.country}</code>,
            `${percent(rate.percent).toFixed(2)}%`,
            <Badge key="band" tone={percent(rate.percent) >= 15 ? 'yellow' : 'slate'}>
              {percent(rate.percent) >= 15 ? 'High' : 'Standard'}
            </Badge>,
            <Badge key="active" tone={rate.active ? 'green' : 'red'}>{rate.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/tax-rates" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={rate.id} />
                <input className="input" name="name" defaultValue={rate.name} />
                <input className="input" name="country" defaultValue={rate.country} />
                <input className="input" name="percent" type="number" min="0" max="100" step="0.01" defaultValue={String(rate.percent)} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={rate.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/tax-rates" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={rate.id} />
                  <button className="btn-secondary">{rate.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/tax-rates" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={rate.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
