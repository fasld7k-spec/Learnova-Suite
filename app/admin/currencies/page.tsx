import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const sampleUsdAmount = 49;

function money(value: number, code: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function decimal(value: unknown) {
  return Number(value || 1);
}

export default async function Currencies() {
  await requireUser(['ADMIN']);
  const rows = await prisma.currency.findMany({ orderBy: [{ active: 'desc' }, { code: 'asc' }] });
  const base = rows.find((currency) => currency.code === 'USD') || rows[0];
  const activeRows = rows.filter((currency) => currency.active);

  return (
    <DashboardShell role="admin" title="Currencies">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{rows.length}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Configured currencies</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{activeRows.length}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Active checkout currencies</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{base?.code || 'USD'}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Base currency</p>
        </div>
      </div>

      <form className="card mt-6 grid gap-3 md:grid-cols-5" action="/api/admin/currencies" method="post">
          <CsrfInput />
        <input className="input" name="code" placeholder="USD" maxLength={3} required />
        <input className="input" name="symbol" placeholder="$" required />
        <input className="input" name="exchangeRate" type="number" step="0.0001" min="0" placeholder="1" required />
        <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
          <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary">Save Currency</button>
      </form>

      <section className="mt-6 border border-[#2F3336] bg-black p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Price Conversion Preview</h2>
            <p className="mt-2 text-sm text-[#71767B]">A USD {sampleUsdAmount} course displayed in active storefront currencies.</p>
          </div>
          <Badge tone="green">Ready</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {activeRows.map((currency) => (
            <div key={currency.code} className="border border-[#2F3336] p-4">
              <p className="text-sm font-bold text-[#71767B]">{currency.code}</p>
              <p className="mt-2 text-2xl font-black text-white">{money(sampleUsdAmount * decimal(currency.exchangeRate), currency.code)}</p>
              <p className="mt-1 text-xs text-[#71767B]">Rate: {decimal(currency.exchangeRate).toFixed(4)}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <DataTable
          headers={['Code', 'Symbol', 'Rate vs USD', 'Sample Display', 'Active', 'Manage']}
          rows={rows.map((currency) => [
            <code key="code" className="font-bold text-white">{currency.code}</code>,
            currency.symbol,
            decimal(currency.exchangeRate).toFixed(4),
            money(sampleUsdAmount * decimal(currency.exchangeRate), currency.code),
            <Badge key="active" tone={currency.active ? 'green' : 'red'}>{currency.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/currencies" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={currency.id} />
                <input className="input" name="code" maxLength={3} defaultValue={currency.code} />
                <input className="input" name="symbol" defaultValue={currency.symbol} />
                <input className="input" name="exchangeRate" type="number" min="0" step="0.0001" defaultValue={String(currency.exchangeRate)} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={currency.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/currencies" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={currency.id} />
                  <button className="btn-secondary">{currency.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/currencies" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={currency.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200" disabled={currency.code === 'USD'}>
                    {currency.code === 'USD' ? 'Base currency' : 'Delete'}
                  </button>
                </form>
              </div>
            </div>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
