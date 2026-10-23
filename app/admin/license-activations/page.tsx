import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function LicenseActivations() {
  await requireUser(['ADMIN']);

  const rows = await prisma.licenseActivation.findMany({ orderBy: { createdAt: 'desc' } });
  const activeCount = rows.filter((row) => row.active).length;

  return (
    <DashboardShell role="admin" title="License Activations">
      <section className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Manual activation</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Add or correct license activations when a license key needs to move to a new domain.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="green">{activeCount} active</Badge>
              <Badge tone="slate">{rows.length} total</Badge>
            </div>
          </div>
          <form className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-[1fr_1fr_1fr_auto_auto]" action="/api/admin/license-activations" method="post">
          <CsrfInput />
            <input className="input" name="purchaseCode" placeholder="License key" required />
            <input className="input" name="domain" placeholder="example.com" required />
            <input className="input" name="email" type="email" placeholder="owner@example.com" />
            <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
            <button className="btn-primary">Add</button>
          </form>
        </div>
      </section>

      <DataTable
        headers={['License Key', 'Domain', 'Email', 'Active', 'Date', 'Manage']}
        rows={rows.map((license) => [
          <span key="code" className="font-mono text-xs font-black text-[#E7E9EA]">{`${license.purchaseCode.slice(0, 8)}...`}</span>,
          license.domain,
          license.email || '-',
          <Badge key="a" tone={license.active ? 'green' : 'red'}>{license.active ? 'Active' : 'Disabled'}</Badge>,
          license.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/license-activations" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={license.id} />
                <input type="hidden" name="action" value="update" />
                <input className="input" name="purchaseCode" defaultValue={license.purchaseCode} required />
                <input className="input" name="domain" defaultValue={license.domain} required />
                <input className="input" name="email" type="email" defaultValue={license.email || ''} />
                <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                  <input type="checkbox" name="active" defaultChecked={license.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Save</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/license-activations" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={license.id} />
                <input type="hidden" name="action" value="toggle" />
                <button className="btn-secondary">{license.active ? 'Disable' : 'Enable'}</button>
              </form>
              <form action="/api/admin/license-activations" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={license.id} />
                <input type="hidden" name="action" value="delete" />
                <button className="btn-secondary">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
