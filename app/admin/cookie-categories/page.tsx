import { Cookie, LockKeyhole, SlidersHorizontal, ToggleRight } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function CookieCategories() {
  await requireUser(['ADMIN']);
  const categories = await prisma.cookieCategory.findMany({ orderBy: { key: 'asc' } });

  const required = categories.filter((category) => category.required).length;
  const active = categories.filter((category) => category.active).length;
  const optional = categories.length - required;

  return (
    <DashboardShell role="admin" title="Cookie Categories">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Categories" value={categories.length} icon={<Cookie size={18} />} />
        <StatCard label="Required" value={required} icon={<LockKeyhole size={18} />} />
        <StatCard label="Optional" value={optional} icon={<SlidersHorizontal size={18} />} />
        <StatCard label="Active" value={active} icon={<ToggleRight size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/cookie-categories" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Consent center</p>
            <h2 className="mt-1 text-2xl font-black text-white">Define a cookie category</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Clear cookie categories improve buyer trust and make the privacy area feel production-ready for international marketplaces.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" name="key" placeholder="analytics" required />
            <input className="input" name="name" placeholder="Analytics" required />
          </div>
          <textarea className="input mt-3 min-h-24" name="description" placeholder="Description" required />
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
              <input type="checkbox" name="required" /> Required
            </label>
            <label className="flex items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
              <input type="checkbox" name="active" defaultChecked /> Active
            </label>
          </div>
          <button className="btn-primary mt-4 w-fit">Save Category</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Privacy readiness</p>
          <h3 className="mt-1 text-xl font-black text-white">Consent coverage</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Essential cookies</span>
              <Badge tone={required ? 'green' : 'yellow'}>{required ? 'Configured' : 'Missing'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Optional choices</span>
              <Badge tone={optional ? 'green' : 'yellow'}>{optional}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Active consent UI</span>
              <Badge tone={active ? 'green' : 'yellow'}>{active}/{categories.length}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Category', 'Key', 'Consent type', 'Status', 'Manage']}
          rows={categories.map((category) => [
            <div key="category">
              <p className="font-bold text-white">{category.name}</p>
              <p className="mt-1 line-clamp-1 text-xs text-[#71767B]">{category.description}</p>
            </div>,
            <code key="key" className="text-xs text-[#1D9BF0]">{category.key}</code>,
            <Badge key="required" tone={category.required ? 'yellow' : 'slate'}>{category.required ? 'Required' : 'Optional'}</Badge>,
            <Badge key="active" tone={category.active ? 'green' : 'red'}>{category.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/cookie-categories" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={category.id} />
                <input className="input" name="key" defaultValue={category.key} />
                <input className="input" name="name" defaultValue={category.name} />
                <textarea className="input min-h-24" name="description" defaultValue={category.description} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="required" defaultChecked={category.required} /> Required
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={category.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/cookie-categories" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={category.id} />
                  <button className="btn-secondary">{category.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/cookie-categories" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={category.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200" disabled={category.required}>
                    {category.required ? 'Required' : 'Delete'}
                  </button>
                </form>
              </div>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
