import Link from 'next/link';
import { Compass, GitBranch, Layers3, ListChecks, Rocket, ToggleLeft, ToggleRight } from 'lucide-react';

import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { getRoadmapItems, roadmapStatuses } from '@/lib/admin-roadmap';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

function statusTone(status: string) {
  if (status === 'Operational') return 'green' as const;
  if (status === 'Configurable') return 'blue' as const;
  if (status === 'Paused') return 'red' as const;
  return 'yellow' as const;
}

export default async function Roadmap() {
  await requireUser(['ADMIN']);
  const [items, productUpdates, featureFlags, tenants, activePayments] = await Promise.all([
    getRoadmapItems(),
    prisma.productUpdate.count({ where: { published: true } }).catch(() => 0),
    prisma.featureFlag.count().catch(() => 0),
    prisma.tenant.count().catch(() => 0),
    prisma.paymentMethod.count({ where: { active: true } }).catch(() => 0),
  ]);

  const activeItems = items.filter((item) => item.active);
  const operational = items.filter((item) => item.status === 'Operational').length;
  const planned = items.filter((item) => item.status === 'Planned').length;

  return (
    <DashboardShell role="admin" title="Product Readiness Map">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Roadmap items" value={items.length} icon={<Compass size={18} />} />
        <StatCard label="Active public items" value={activeItems.length} icon={<ToggleRight size={18} />} />
        <StatCard label="Operational" value={operational} icon={<ListChecks size={18} />} />
        <StatCard label="Planned" value={planned} icon={<ToggleLeft size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/roadmap" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-wide text-[#71767B]">Buyer readiness</p>
            <h2 className="mt-1 text-2xl font-black text-white">Add roadmap item</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              This page is now admin-managed. Use it to describe what is complete, configurable, planned, or paused for buyers and reviewers.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_120px]">
            <input className="input" name="title" placeholder="Mobile app integration" required />
            <select className="input" name="status" defaultValue="Planned">
              {roadmapStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
            <input className="input" name="sortOrder" type="number" placeholder="Sort" defaultValue={(items.length + 1) * 10} />
          </div>
          <input className="input mt-3" name="href" placeholder="/admin/mobile-app" defaultValue="/admin/roadmap" required />
          <textarea className="input mt-3 min-h-28" name="description" placeholder="Explain what is included and how buyers can configure it." required />
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Roadmap Item</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-black uppercase tracking-wide text-[#71767B]">Live evidence</p>
          <h3 className="mt-1 text-xl font-black text-white">Connected platform signals</h3>
          <div className="mt-4 grid gap-3 text-sm text-[#E7E9EA]">
            <Link className="flex items-center justify-between gap-3 border border-[#2F3336] p-3 hover:border-[#1D9BF0]" href="/admin/product-updates">
              <span className="flex items-center gap-2"><Rocket size={16} className="text-[#1D9BF0]" /> Published updates</span>
              <Badge tone={productUpdates ? 'green' : 'yellow'}>{productUpdates}</Badge>
            </Link>
            <Link className="flex items-center justify-between gap-3 border border-[#2F3336] p-3 hover:border-[#1D9BF0]" href="/admin/feature-flags">
              <span className="flex items-center gap-2"><GitBranch size={16} className="text-[#1D9BF0]" /> Feature flags</span>
              <Badge tone={featureFlags ? 'green' : 'slate'}>{featureFlags}</Badge>
            </Link>
            <Link className="flex items-center justify-between gap-3 border border-[#2F3336] p-3 hover:border-[#1D9BF0]" href="/admin/tenants">
              <span className="flex items-center gap-2"><Layers3 size={16} className="text-[#1D9BF0]" /> Tenants</span>
              <Badge tone={tenants ? 'green' : 'slate'}>{tenants}</Badge>
            </Link>
            <Link className="flex items-center justify-between gap-3 border border-[#2F3336] p-3 hover:border-[#1D9BF0]" href="/admin/payment-gateways">
              <span className="flex items-center gap-2"><ListChecks size={16} className="text-[#1D9BF0]" /> Active payments</span>
              <Badge tone={activePayments ? 'green' : 'yellow'}>{activePayments}</Badge>
            </Link>
          </div>
        </aside>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {activeItems.map((item) => (
          <Link className="card block transition hover:border-[#1D9BF0]" href={item.href} key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black text-white">{item.title}</h2>
              <Badge tone={statusTone(item.status)}>{item.status}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#71767B]">{item.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Item', 'Status', 'Sort', 'Visible', 'Manage']}
          rows={items.map((item) => [
            <div key="item" className="max-w-xl">
              <p className="font-black text-white">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#71767B]">{item.description}</p>
              <Link className="mt-2 inline-block text-xs font-bold text-[#1D9BF0]" href={item.href}>{item.href}</Link>
            </div>,
            <Badge key="status" tone={statusTone(item.status)}>{item.status}</Badge>,
            item.sortOrder,
            <Badge key="active" tone={item.active ? 'green' : 'red'}>{item.active ? 'Active' : 'Hidden'}</Badge>,
            <div key="manage" className="grid min-w-96 gap-2">
              <form className="grid gap-2" action="/api/admin/roadmap" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={item.id} />
                <input className="input" name="title" defaultValue={item.title} />
                <select className="input" name="status" defaultValue={item.status}>
                  {roadmapStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
                </select>
                <input className="input" name="href" defaultValue={item.href} />
                <input className="input" name="sortOrder" type="number" defaultValue={item.sortOrder} />
                <textarea className="input min-h-24" name="description" defaultValue={item.description} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={item.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/roadmap" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-secondary">{item.active ? 'Hide' : 'Show'}</button>
                </form>
                <form action="/api/admin/roadmap" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>,
          ])}
        />
      </section>
    </DashboardShell>
  );
}
