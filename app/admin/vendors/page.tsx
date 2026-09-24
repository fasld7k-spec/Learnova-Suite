import { BriefcaseBusiness, FileCheck2, Globe2, MailCheck } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Vendors() {
  await requireUser(['ADMIN']);
  const [vendors, contracts] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.vendorContract.findMany({ orderBy: { createdAt: 'desc' } })
  ]);

  const active = vendors.filter((vendor) => vendor.active).length;
  const withEmail = vendors.filter((vendor) => vendor.email).length;
  const withWebsite = vendors.filter((vendor) => vendor.website).length;
  const contractCounts = new Map<string, number>();
  contracts.forEach((contract) => {
    contractCounts.set(contract.vendorId, (contractCounts.get(contract.vendorId) ?? 0) + 1);
  });

  return (
    <DashboardShell role="admin" title="Vendors">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Vendors" value={vendors.length} icon={<BriefcaseBusiness size={18} />} />
        <StatCard label="Active" value={active} icon={<FileCheck2 size={18} />} />
        <StatCard label="Email coverage" value={`${withEmail}/${vendors.length}`} icon={<MailCheck size={18} />} />
        <StatCard label="Web profiles" value={withWebsite} icon={<Globe2 size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/vendors" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Partner network</p>
            <h2 className="mt-1 text-2xl font-black text-white">Add a vendor profile</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Vendors cover external content providers, live training partners, certification bodies and implementation service teams.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="name" placeholder="Vendor name" required />
            <input className="input" name="email" type="email" placeholder="Email" />
            <input className="input" name="website" placeholder="Website" />
          </div>
          <label className="mt-3 flex gap-2 text-sm font-semibold text-slate-200">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Vendor</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Commercial controls</p>
          <h3 className="mt-1 text-xl font-black text-white">Vendor readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Contracts attached</span>
              <Badge tone={contracts.length ? 'green' : 'yellow'}>{contracts.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Contact coverage</span>
              <Badge tone={withEmail === vendors.length && vendors.length ? 'green' : 'yellow'}>{withEmail}/{vendors.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Public profiles</span>
              <Badge tone={withWebsite ? 'green' : 'yellow'}>{withWebsite}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Vendor', 'Contact', 'Website', 'Contracts', 'Status', 'Manage']}
          rows={vendors.map((vendor) => [
            <div key="vendor">
              <p className="font-bold text-white">{vendor.name}</p>
              <p className="mt-1 text-xs text-[#71767B]">Added {vendor.createdAt.toLocaleDateString()}</p>
            </div>,
            vendor.email || '-',
            vendor.website ? <span key="site" className="text-[#1D9BF0]">{vendor.website}</span> : '-',
            contractCounts.get(vendor.id) ?? 0,
            <Badge key="active" tone={vendor.active ? 'green' : 'red'}>{vendor.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/vendors" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={vendor.id} />
                <input className="input" name="name" defaultValue={vendor.name} />
                <input className="input" name="email" type="email" defaultValue={vendor.email || ''} />
                <input className="input" name="website" defaultValue={vendor.website || ''} />
                <label className="flex gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={vendor.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/vendors" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={vendor.id} />
                  <button className="btn-secondary">{vendor.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/vendors" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={vendor.id} />
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
