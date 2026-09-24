import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

function PartnerSelect({ partners, selected }: { partners: { id: string; name: string }[]; selected?: string }) {
  return (
    <select className="input" name="partnerId" defaultValue={selected}>
      {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
    </select>
  );
}

export default async function PartnerOffers() {
  await requireUser(['ADMIN']);
  const [partners, rows] = await Promise.all([
    prisma.partner.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.partnerOffer.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const partnerById = new Map(partners.map((partner) => [partner.id, partner.name]));

  return (
    <DashboardShell role="admin" title="Partner Offers">
      <form className="card mb-6 grid gap-3" action="/api/admin/partner-offers" method="post">
          <CsrfInput />
        <PartnerSelect partners={partners} />
        <input className="input" name="title" placeholder="Offer title" required />
        <textarea className="input min-h-28" name="description" placeholder="Description" />
        <input className="input" name="url" placeholder="URL or /path" />
        <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked /> Active</label>
        <button className="btn-primary w-fit" disabled={!partners.length}>Save Offer</button>
      </form>

      <DataTable
        headers={['Title', 'Partner', 'URL', 'Status', 'Manage']}
        rows={rows.map((offer) => [
          <div key="title" className="min-w-64">
            <p className="font-black text-white">{offer.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-[#71767B]">{offer.description}</p>
          </div>,
          partnerById.get(offer.partnerId) || offer.partnerId,
          <span key="url" className="max-w-xs break-all text-sm text-[#1D9BF0]">{offer.url || '-'}</span>,
          <Badge key="status" tone={offer.active ? 'green' : 'red'}>{offer.active ? 'Active' : 'Disabled'}</Badge>,
          <div key="manage" className="grid min-w-72 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/partner-offers" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={offer.id} />
                <PartnerSelect partners={partners} selected={offer.partnerId} />
                <input className="input" name="title" defaultValue={offer.title} required />
                <textarea className="input min-h-24" name="description" defaultValue={offer.description} />
                <input className="input" name="url" defaultValue={offer.url || ''} />
                <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked={offer.active} /> Active</label>
                <button className="btn-primary w-fit">Save</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/partner-offers" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={offer.id} />
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="active" value={offer.active ? 'false' : 'true'} />
                <button className="btn-secondary">{offer.active ? 'Disable' : 'Activate'}</button>
              </form>
              <form action="/api/admin/partner-offers" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={offer.id} />
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
