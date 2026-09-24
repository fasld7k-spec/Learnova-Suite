import { FileBadge2, FileLock2, Handshake, TimerReset } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function VendorContracts() {
  await requireUser(['ADMIN']);
  const [vendors, contracts] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    prisma.vendorContract.findMany({ orderBy: { createdAt: 'desc' } })
  ]);

  const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const active = contracts.filter((contract) => contract.status === 'ACTIVE').length;
  const withFiles = contracts.filter((contract) => contract.fileUrl).length;
  const dated = contracts.filter((contract) => contract.startsAt || contract.endsAt).length;
  const vendorCoverage = new Set(contracts.map((contract) => contract.vendorId)).size;

  return (
    <DashboardShell role="admin" title="Vendor Contracts">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Contracts" value={contracts.length} icon={<FileBadge2 size={18} />} />
        <StatCard label="Active" value={active} icon={<Handshake size={18} />} />
        <StatCard label="Files attached" value={withFiles} icon={<FileLock2 size={18} />} />
        <StatCard label="Vendors covered" value={vendorCoverage} icon={<TimerReset size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/vendor-contracts" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Partner agreements</p>
            <h2 className="mt-1 text-2xl font-black text-white">Attach a vendor contract</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Contracts help administrators track content providers, implementation partners and certification agreements from one commercial desk.
            </p>
          </div>
          <div className="grid gap-3">
            <select className="input" name="vendorId" required>
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
            <input className="input" name="title" placeholder="Contract title" required />
            <input className="input" name="fileUrl" placeholder="File URL" />
            <div className="grid gap-3 md:grid-cols-3">
              <input className="input" name="startsAt" type="date" />
              <input className="input" name="endsAt" type="date" />
              <select className="input" name="status" defaultValue="ACTIVE">
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
            </div>
          </div>
          <button className="btn-primary mt-4 w-fit">Save Contract</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Commercial readiness</p>
          <h3 className="mt-1 text-xl font-black text-white">Contract coverage</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Vendors covered</span>
              <Badge tone={vendorCoverage ? 'green' : 'yellow'}>{vendorCoverage}/{vendors.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Attached files</span>
              <Badge tone={withFiles === contracts.length && contracts.length ? 'green' : 'yellow'}>{withFiles}/{contracts.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Dated agreements</span>
              <Badge tone={dated ? 'green' : 'slate'}>{dated}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Contract', 'Vendor', 'File', 'Dates', 'Status', 'Manage']}
          rows={contracts.map((contract) => [
            <div key="contract">
              <p className="font-bold text-white">{contract.title}</p>
              <p className="mt-1 text-xs text-[#71767B]">Added {contract.createdAt.toLocaleDateString()}</p>
            </div>,
            vendorNames.get(contract.vendorId) || contract.vendorId,
            contract.fileUrl ? <Badge key="file" tone="green">Attached</Badge> : <Badge key="file" tone="yellow">Missing</Badge>,
            contract.startsAt || contract.endsAt ? `${contract.startsAt?.toLocaleDateString() ?? 'Open'} - ${contract.endsAt?.toLocaleDateString() ?? 'Open'}` : '-',
            <Badge key="status" tone={contract.status === 'ACTIVE' ? 'green' : contract.status === 'TERMINATED' ? 'red' : 'yellow'}>{contract.status}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/vendor-contracts" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={contract.id} />
                <select className="input" name="vendorId" defaultValue={contract.vendorId}>
                  {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
                <input className="input" name="title" defaultValue={contract.title} />
                <input className="input" name="fileUrl" defaultValue={contract.fileUrl || ''} />
                <div className="grid gap-2 md:grid-cols-3">
                  <input className="input" name="startsAt" type="date" defaultValue={contract.startsAt?.toISOString().slice(0, 10) || ''} />
                  <input className="input" name="endsAt" type="date" defaultValue={contract.endsAt?.toISOString().slice(0, 10) || ''} />
                  <select className="input" name="status" defaultValue={contract.status}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <form action="/api/admin/vendor-contracts" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={contract.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
