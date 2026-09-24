import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const money = (value: unknown) => Number(value || 0).toFixed(2);

export default async function Donations() {
  await requireUser(['ADMIN']);
  const rows = await prisma.donationCampaign.findMany({ orderBy: { createdAt: 'desc' } });
  const donations = await prisma.donation.groupBy({
    by: ['campaignId'],
    _sum: { amount: true },
    _count: { id: true },
  });
  const stats = new Map(donations.map((row) => [row.campaignId, row]));

  return (
    <DashboardShell role="admin" title="Donation Campaigns">
      <form className="card mb-6 grid gap-3" action="/api/admin/donations" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Campaign title" />
        <textarea className="input" name="description" placeholder="Description" />
        <input className="input" name="goal" type="number" min="0" step="0.01" placeholder="Goal" />
        <label className="flex gap-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Save Campaign</button>
      </form>

      <DataTable
        headers={['Campaign', 'Goal', 'Raised', 'Status', 'Actions']}
        rows={rows.map((campaign) => {
          const raised = stats.get(campaign.id);
          return [
            <div key="campaign" className="min-w-72">
              <p className="font-black text-white">{campaign.title}</p>
              <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-400">{campaign.description}</p>
            </div>,
            `$${money(campaign.goal)}`,
            <span key="raised">
              ${money(raised?._sum.amount)} <span className="text-xs text-slate-400">from {raised?._count.id || 0} donations</span>
            </span>,
            <Badge key="status" tone={campaign.active ? 'green' : 'red'}>{campaign.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="actions" className="grid min-w-80 gap-3">
              <form className="grid gap-2" action="/api/admin/donations" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={campaign.id} />
                <input className="input" name="title" defaultValue={campaign.title} />
                <textarea className="input min-h-20" name="description" defaultValue={campaign.description} />
                <input className="input" name="goal" type="number" min="0" step="0.01" defaultValue={money(campaign.goal)} />
                <label className="flex gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={campaign.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/donations" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={campaign.id} />
                  <button className="btn-secondary">{campaign.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/donations" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={campaign.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>,
          ];
        })}
      />
    </DashboardShell>
  );
}
