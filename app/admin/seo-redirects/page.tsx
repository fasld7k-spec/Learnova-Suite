import { ArrowRightLeft, Link2, MousePointerClick, RouteOff } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function SeoRedirects() {
  await requireUser(['ADMIN']);
  const redirects = await prisma.seoRedirect.findMany({ orderBy: { createdAt: 'desc' } });

  const active = redirects.filter((redirect) => redirect.active).length;
  const permanent = redirects.filter((redirect) => redirect.status === 301).length;
  const temporary = redirects.filter((redirect) => redirect.status !== 301).length;
  const internal = redirects.filter((redirect) => redirect.toPath.startsWith('/')).length;

  return (
    <DashboardShell role="admin" title="SEO Redirects">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Redirects" value={redirects.length} icon={<ArrowRightLeft size={18} />} />
        <StatCard label="Active" value={active} icon={<MousePointerClick size={18} />} />
        <StatCard label="Permanent" value={permanent} icon={<Link2 size={18} />} />
        <StatCard label="Temporary" value={temporary} icon={<RouteOff size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/seo-redirects" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Search migration</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a redirect rule</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Redirects protect traffic after course slug changes, CMS migrations, campaign refreshes and marketplace restructuring.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
            <input className="input" name="fromPath" placeholder="/old" required />
            <input className="input" name="toPath" placeholder="/new" required />
            <input className="input" name="status" type="number" defaultValue={301} />
          </div>
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Redirect</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">SEO readiness</p>
          <h3 className="mt-1 text-xl font-black text-white">Redirect hygiene</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Permanent redirects</span>
              <Badge tone={permanent ? 'green' : 'yellow'}>{permanent}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Internal destinations</span>
              <Badge tone={internal === redirects.length && redirects.length ? 'green' : 'yellow'}>{internal}/{redirects.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Active routing</span>
              <Badge tone={active ? 'green' : 'yellow'}>{active}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['From', 'To', 'HTTP', 'Type', 'Status', 'Manage']}
          rows={redirects.map((redirect) => [
            <code key="from" className="text-xs text-[#1D9BF0]">{redirect.fromPath}</code>,
            <code key="to" className="text-xs text-[#1D9BF0]">{redirect.toPath}</code>,
            redirect.status,
            <Badge key="type" tone={redirect.status === 301 ? 'green' : 'yellow'}>{redirect.status === 301 ? 'Permanent' : 'Temporary'}</Badge>,
            <Badge key="active" tone={redirect.active ? 'green' : 'red'}>{redirect.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/seo-redirects" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={redirect.id} />
                <input className="input" name="fromPath" defaultValue={redirect.fromPath} />
                <input className="input" name="toPath" defaultValue={redirect.toPath} />
                <input className="input" name="status" type="number" defaultValue={redirect.status} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={redirect.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/seo-redirects" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={redirect.id} />
                  <button className="btn-secondary">{redirect.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/seo-redirects" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={redirect.id} />
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
