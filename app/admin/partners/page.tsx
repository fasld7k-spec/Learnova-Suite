import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Partners() {
  await requireUser(['ADMIN']);
  const rows = await prisma.partner.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="admin" title="Partners">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/admin/partners" method="post">
          <CsrfInput />
        <input className="input" name="name" placeholder="Partner name" required />
        <input className="input" name="website" placeholder="https://partner.com" />
        <input className="input" name="logoUrl" placeholder="Logo URL or /path" />
        <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked /> Active</label>
        <button className="btn-primary w-fit">Save Partner</button>
      </form>

      <DataTable
        headers={['Name', 'Website', 'Logo', 'Status', 'Manage']}
        rows={rows.map((partner) => [
          <span key="name" className="font-black text-white">{partner.name}</span>,
          <span key="website" className="max-w-xs break-all text-sm text-[#1D9BF0]">{partner.website || '-'}</span>,
          <span key="logo" className="max-w-xs break-all text-xs text-[#71767B]">{partner.logoUrl || '-'}</span>,
          <Badge key="status" tone={partner.active ? 'green' : 'red'}>{partner.active ? 'Active' : 'Disabled'}</Badge>,
          <div key="manage" className="grid min-w-72 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/partners" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={partner.id} />
                <input className="input" name="name" defaultValue={partner.name} required />
                <input className="input" name="website" defaultValue={partner.website || ''} />
                <input className="input" name="logoUrl" defaultValue={partner.logoUrl || ''} />
                <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked={partner.active} /> Active</label>
                <button className="btn-primary w-fit">Save</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/partners" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={partner.id} />
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="active" value={partner.active ? 'false' : 'true'} />
                <button className="btn-secondary">{partner.active ? 'Disable' : 'Activate'}</button>
              </form>
              <form action="/api/admin/partners" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={partner.id} />
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
