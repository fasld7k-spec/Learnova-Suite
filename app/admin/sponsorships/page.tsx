import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

function dateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 16) : '';
}

export default async function Sponsorships() {
  await requireUser(['ADMIN']);
  const rows = await prisma.sponsorship.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="admin" title="Sponsorships">
      <form className="card mb-6 grid gap-3 md:grid-cols-2" action="/api/admin/sponsorships" method="post">
          <CsrfInput />
        <input className="input" name="sponsor" placeholder="Sponsor" required />
        <input className="input" name="placement" placeholder="home_top" required />
        <input className="input" name="imageUrl" placeholder="Image URL or /path" />
        <input className="input" name="targetUrl" placeholder="Target URL or /path" />
        <input className="input" name="startsAt" type="datetime-local" />
        <input className="input" name="endsAt" type="datetime-local" />
        <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked /> Active</label>
        <button className="btn-primary w-fit">Save Sponsorship</button>
      </form>

      <DataTable
        headers={['Sponsor', 'Placement', 'Schedule', 'Links', 'Status', 'Manage']}
        rows={rows.map((item) => [
          <span key="sponsor" className="font-black text-white">{item.sponsor}</span>,
          <span key="placement" className="text-sm text-[#E7E9EA]">{item.placement}</span>,
          <span key="schedule" className="text-xs text-[#71767B]">
            {item.startsAt ? item.startsAt.toLocaleString() : 'Now'} - {item.endsAt ? item.endsAt.toLocaleString() : 'No end'}
          </span>,
          <div key="links" className="max-w-xs space-y-1 break-all text-xs text-[#71767B]">
            <p>{item.imageUrl || 'No image'}</p>
            <p>{item.targetUrl || 'No target'}</p>
          </div>,
          <Badge key="active" tone={item.active ? 'green' : 'red'}>{item.active ? 'Active' : 'Disabled'}</Badge>,
          <div key="manage" className="grid min-w-72 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/sponsorships" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="action" value="update" />
                <input className="input" name="sponsor" defaultValue={item.sponsor} required />
                <input className="input" name="placement" defaultValue={item.placement} required />
                <input className="input" name="imageUrl" defaultValue={item.imageUrl || ''} />
                <input className="input" name="targetUrl" defaultValue={item.targetUrl || ''} />
                <input className="input" name="startsAt" type="datetime-local" defaultValue={dateInput(item.startsAt)} />
                <input className="input" name="endsAt" type="datetime-local" defaultValue={dateInput(item.endsAt)} />
                <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked={item.active} /> Active</label>
                <button className="btn-primary w-fit">Save</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/sponsorships" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="active" value={item.active ? 'false' : 'true'} />
                <button className="btn-secondary">{item.active ? 'Disable' : 'Activate'}</button>
              </form>
              <form action="/api/admin/sponsorships" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={item.id} />
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
