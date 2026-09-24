import { CalendarClock, Megaphone, PackageCheck, Rocket } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function ProductUpdates() {
  await requireUser(['ADMIN']);
  const updates = await prisma.productUpdate.findMany({ orderBy: { createdAt: 'desc' } });

  const published = updates.filter((update) => update.published).length;
  const drafts = updates.length - published;
  const latest = updates[0]?.version ?? '0.0.0';

  return (
    <DashboardShell role="admin" title="Product Updates">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Updates" value={updates.length} icon={<Rocket size={18} />} />
        <StatCard label="Published" value={published} icon={<Megaphone size={18} />} />
        <StatCard label="Drafts" value={drafts} icon={<CalendarClock size={18} />} />
        <StatCard label="Latest version" value={latest} icon={<PackageCheck size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/product-updates" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Release notes</p>
            <h2 className="mt-1 text-2xl font-black text-white">Publish a product update</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              A visible changelog helps buyers trust that Learnova Suite is maintained, documented and ready for commercial operation.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <input className="input" name="version" placeholder="1.0.1" required />
            <input className="input" name="title" placeholder="Update title" required />
          </div>
          <textarea className="input mt-3 min-h-28" name="body" placeholder="Release notes" required />
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="published" /> Published
          </label>
          <button className="btn-primary mt-4 w-fit">Save Update</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Buyer confidence</p>
          <h3 className="mt-1 text-xl font-black text-white">Changelog readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Public notes</span>
              <Badge tone={published ? 'green' : 'yellow'}>{published}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Draft queue</span>
              <Badge tone={drafts ? 'yellow' : 'green'}>{drafts}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Versioning</span>
              <Badge tone={updates.every((update) => /\d+\.\d+\.\d+/.test(update.version)) ? 'green' : 'yellow'}>Checked</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Version', 'Update', 'Status', 'Date', 'Manage']}
          rows={updates.map((update) => [
            <code key="version" className="text-xs text-[#1D9BF0]">{update.version}</code>,
            <div key="update" className="max-w-xl">
              <p className="font-bold text-white">{update.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-[#71767B]">{update.body}</p>
            </div>,
            <Badge key="published" tone={update.published ? 'green' : 'yellow'}>{update.published ? 'Published' : 'Draft'}</Badge>,
            update.createdAt.toLocaleDateString(),
            <div key="manage" className="grid min-w-96 gap-2">
              <form className="grid gap-2" action="/api/admin/product-updates" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={update.id} />
                <input className="input" name="version" defaultValue={update.version} />
                <input className="input" name="title" defaultValue={update.title} />
                <textarea className="input min-h-24" name="body" defaultValue={update.body} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="published" defaultChecked={update.published} /> Published
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/product-updates" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={update.id} />
                  <button className="btn-secondary">{update.published ? 'Unpublish' : 'Publish'}</button>
                </form>
                <form action="/api/admin/product-updates" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={update.id} />
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
