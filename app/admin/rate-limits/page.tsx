import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';

export default async function RateLimits() {
  await requireUser(['ADMIN']);
  const rows = await prisma.rateLimitRule.findMany({ orderBy: { createdAt: 'desc' } });
  const active = rows.filter((row) => row.active).length;

  return (
    <DashboardShell role="admin" title="Rate Limits">
      <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <form className="card grid gap-3 md:grid-cols-[1fr_140px_140px_140px_auto]" action="/api/admin/rate-limits" method="post">
          <CsrfInput />
          <input className="input" name="key" placeholder="auth.login" />
          <input className="input" name="limit" type="number" min="1" placeholder="20" />
          <input className="input" name="windowSec" type="number" min="1" placeholder="60" />
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary">Save</button>
        </form>
        <div className="card">
          <h2 className="text-lg font-black">Policy coverage</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="green">{active} active</Badge>
            <Badge tone="slate">{rows.length} rules</Badge>
          </div>
          <p className="mt-3 text-sm text-[#71767B]">
            Active rules are enforced by the runtime request limiter. Use exact keys like public.contact, or base keys like auth.2fa.verify to cover dynamic session suffixes.
          </p>
        </div>
      </section>
      <DataTable
        headers={['Key', 'Limit', 'Window', 'Active', 'Created', 'Manage']}
        rows={rows.map((rule) => [
          rule.key,
          rule.limit,
          `${rule.windowSec}s`,
          <Badge key="a" tone={rule.active ? 'green' : 'red'}>
            {rule.active ? 'Active' : 'Disabled'}
          </Badge>,
          rule.createdAt.toLocaleString(),
          <div key="manage" className="grid min-w-[320px] gap-3">
            <form className="grid gap-2" action="/api/admin/rate-limits" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={rule.id} />
              <input className="input" name="key" defaultValue={rule.key} aria-label="Policy key" />
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="input" name="limit" type="number" min="1" defaultValue={rule.limit} aria-label="Limit" />
                <input className="input" name="windowSec" type="number" min="1" defaultValue={rule.windowSec} aria-label="Window seconds" />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                <input type="checkbox" name="active" defaultChecked={rule.active} /> Active
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/rate-limits" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={rule.id} />
                <button className="btn-secondary">{rule.active ? 'Disable' : 'Enable'}</button>
              </form>
              <form action="/api/admin/rate-limits" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={rule.id} />
                <button className="btn-secondary">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
