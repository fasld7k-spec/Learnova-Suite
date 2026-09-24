import { Globe2, ImageIcon, SearchCheck, Tags } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

function isComplete(meta: { title: string; description: string; image: string | null }) {
  return meta.title.length >= 35 && meta.description.length >= 80 && Boolean(meta.image);
}

export default async function SeoMeta() {
  await requireUser(['ADMIN']);
  const rows = await prisma.seoMetaOverride.findMany({ orderBy: { createdAt: 'desc' } });

  const withImages = rows.filter((row) => row.image).length;
  const complete = rows.filter(isComplete).length;
  const courseRoutes = rows.filter((row) => row.path.startsWith('/courses')).length;

  return (
    <DashboardShell role="admin" title="SEO Meta Overrides">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Overrides" value={rows.length} icon={<SearchCheck size={18} />} />
        <StatCard label="Complete snippets" value={complete} icon={<Tags size={18} />} />
        <StatCard label="OG images" value={withImages} icon={<ImageIcon size={18} />} />
        <StatCard label="Course routes" value={courseRoutes} icon={<Globe2 size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/seo-meta" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Search appearance</p>
            <h2 className="mt-1 text-2xl font-black text-white">Tune a public page snippet</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Add page-level metadata for high-value marketplace routes, campaign pages and category landing pages without touching source code.
            </p>
          </div>
          <div className="grid gap-3">
            <input className="input" name="path" placeholder="/courses" required />
            <input className="input" name="title" placeholder="SEO title" required />
            <textarea className="input min-h-28" name="description" placeholder="SEO description" required />
            <input className="input" name="image" placeholder="OG image URL" />
          </div>
          <button className="btn-primary mt-4 w-fit">Save Meta</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Review signals</p>
          <h3 className="mt-1 text-xl font-black text-white">Metadata readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Image coverage</span>
              <Badge tone={withImages === rows.length && rows.length ? 'green' : 'yellow'}>{withImages}/{rows.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Snippet quality</span>
              <Badge tone={complete ? 'green' : 'yellow'}>{complete ? 'Tracked' : 'Needs data'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Canonical paths</span>
              <Badge tone={rows.every((row) => row.path.startsWith('/')) ? 'green' : 'red'}>Checked</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Route', 'Title', 'Description', 'Image', 'Status', 'Manage']}
          rows={rows.map((row) => [
            <code key="path" className="text-xs text-[#1D9BF0]">{row.path}</code>,
            <div key="title" className="max-w-sm">
              <p className="font-bold text-white">{row.title}</p>
              <p className="mt-1 text-xs text-[#71767B]">{row.title.length} characters</p>
            </div>,
            <p key="description" className="max-w-xl line-clamp-2 text-sm text-[#E7E9EA]">{row.description}</p>,
            row.image ? <Badge key="image" tone="green">Ready</Badge> : <Badge key="image" tone="yellow">Missing</Badge>,
            <Badge key="status" tone={isComplete(row) ? 'green' : 'yellow'}>{isComplete(row) ? 'Optimized' : 'Draft'}</Badge>,
            <div key="manage" className="grid min-w-96 gap-2">
              <form className="grid gap-2" action="/api/admin/seo-meta" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={row.id} />
                <input className="input" name="path" defaultValue={row.path} />
                <input className="input" name="title" defaultValue={row.title} />
                <textarea className="input min-h-24" name="description" defaultValue={row.description} />
                <input className="input" name="image" defaultValue={row.image || ''} />
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <form action="/api/admin/seo-meta" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
