import { LifeBuoy, Palette, Tags, Workflow } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isValidColor(color: string) {
  return HEX_COLOR.test(color);
}

export default async function SupportTags() {
  await requireUser(['ADMIN']);
  const tags = await prisma.supportTag.findMany({ orderBy: { name: 'asc' } });

  const validColors = tags.filter((tag) => isValidColor(tag.color)).length;
  const billingTags = tags.filter((tag) => /billing|payment|refund|invoice/i.test(tag.name)).length;
  const opsTags = tags.filter((tag) => /bug|technical|access|account|course/i.test(tag.name)).length;

  return (
    <DashboardShell role="admin" title="Support Tags">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tags" value={tags.length} icon={<Tags size={18} />} />
        <StatCard label="Valid colors" value={validColors} icon={<Palette size={18} />} />
        <StatCard label="Billing coverage" value={billingTags} icon={<LifeBuoy size={18} />} />
        <StatCard label="Ops coverage" value={opsTags} icon={<Workflow size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/support-tags" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Support taxonomy</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a triage tag</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Tags help support teams separate billing, course access, instructor, technical and refund conversations while keeping queues easy to scan.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <input className="input" name="name" placeholder="billing" required />
            <input className="input" name="color" placeholder="#0284c7" defaultValue="#0284c7" required />
          </div>
          <button className="btn-primary mt-4 w-fit">Save Tag</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Queue design</p>
          <h3 className="mt-1 text-xl font-black text-white">Triage readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Color validation</span>
              <Badge tone={validColors === tags.length && tags.length ? 'green' : 'yellow'}>{validColors}/{tags.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Commercial tags</span>
              <Badge tone={billingTags ? 'green' : 'yellow'}>{billingTags ? 'Covered' : 'Add billing'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Operational tags</span>
              <Badge tone={opsTags ? 'green' : 'yellow'}>{opsTags ? 'Covered' : 'Add ops'}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Tag', 'Swatch', 'Color', 'Created', 'Status', 'Manage']}
          rows={tags.map((tag) => [
            <p key="name" className="font-bold text-white">{tag.name}</p>,
            <span key="swatch" className="inline-block h-5 w-10 border border-[#2F3336]" style={{ backgroundColor: tag.color }} />,
            <code key="color" className="text-xs text-[#1D9BF0]">{tag.color}</code>,
            tag.createdAt.toLocaleDateString(),
            <Badge key="status" tone={isValidColor(tag.color) ? 'green' : 'red'}>{isValidColor(tag.color) ? 'Ready' : 'Invalid'}</Badge>,
            <div key="manage" className="flex min-w-72 flex-wrap gap-2">
              <form className="flex flex-wrap gap-2" action="/api/admin/support-tags" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={tag.id} />
                <input className="input min-w-32" name="name" defaultValue={tag.name} />
                <input className="input w-32" name="color" defaultValue={tag.color} />
                <button className="btn-secondary">Update</button>
              </form>
              <form action="/api/admin/support-tags" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={tag.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
