import { FileSearch, FileText, Globe2, Languages } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Pages() {
  await requireUser(['ADMIN']);
  const pages = await prisma.page.findMany({ orderBy: { slug: 'asc' } });
  const localized = pages.filter((page) => page.titleAr?.trim() && page.bodyAr?.trim()).length;
  const seoReady = pages.filter((page) => page.seoTitle?.trim() && page.seoDescription?.trim()).length;

  return (
    <DashboardShell role="admin" title="Static Pages">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="CMS pages" value={pages.length} icon={<FileText size={18} />} />
        <StatCard label="Localized" value={localized} icon={<Languages size={18} />} />
        <StatCard label="SEO ready" value={seoReady} icon={<FileSearch size={18} />} />
        <StatCard label="Public routes" value={pages.length} icon={<Globe2 size={18} />} />
      </div>

      <div className="mt-6 grid gap-4 2xl:grid-cols-[420px_1fr]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/pages" method="post">
          <CsrfInput />
          <h2 className="text-lg font-black text-white">Create CMS Page</h2>
          <p className="mt-1 text-sm font-semibold text-[#71767B]">Add buyer-facing legal, about, support and policy pages with bilingual content and SEO metadata.</p>
          <div className="mt-5 grid gap-3">
            <input className="input" name="slug" placeholder="refund-policy" required />
            <input className="input" name="titleEn" placeholder="English title" required />
            <input className="input" name="titleAr" placeholder="Arabic title" required />
            <textarea className="input min-h-28" name="bodyEn" placeholder="English body" required />
            <textarea className="input min-h-28" name="bodyAr" placeholder="Arabic body" required />
            <input className="input" name="seoTitle" placeholder="SEO title" />
            <input className="input" name="seoDescription" placeholder="SEO description" />
            <button className="btn-primary w-fit">Save Page</button>
          </div>
        </form>

        <section>
          <h2 className="text-lg font-black text-white">CMS Inventory</h2>
          <p className="mb-3 mt-1 text-sm font-semibold text-[#71767B]">Review public pages for localization and search metadata before handing the marketplace to a buyer.</p>
          <DataTable
            headers={['Slug', 'Titles', 'Localization', 'SEO', 'Manage']}
            rows={pages.map((page) => [
              <a key="slug" className="font-bold text-[#1D9BF0]" href={`/pages/${page.slug}`}>/{page.slug}</a>,
              <div key="titles" className="min-w-[240px]">
                <p className="font-bold text-white">{page.titleEn}</p>
                <p className="mt-1 text-xs font-semibold text-[#71767B]">{page.titleAr}</p>
              </div>,
              <Badge key="localized" tone={page.titleAr && page.bodyAr ? 'green' : 'yellow'}>{page.titleAr && page.bodyAr ? 'Ready' : 'Needs copy'}</Badge>,
              <Badge key="seo" tone={page.seoTitle && page.seoDescription ? 'green' : 'yellow'}>{page.seoTitle && page.seoDescription ? 'Ready' : 'Missing'}</Badge>,
              <div key="manage" className="grid min-w-96 gap-2">
                <form className="grid gap-2" action="/api/admin/pages" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="update" />
                  <input type="hidden" name="id" value={page.id} />
                  <input className="input" name="slug" defaultValue={page.slug} />
                  <input className="input" name="titleEn" defaultValue={page.titleEn} />
                  <input className="input" name="titleAr" defaultValue={page.titleAr} />
                  <textarea className="input min-h-24" name="bodyEn" defaultValue={page.bodyEn} />
                  <textarea className="input min-h-24" name="bodyAr" defaultValue={page.bodyAr} />
                  <input className="input" name="seoTitle" defaultValue={page.seoTitle || ''} />
                  <input className="input" name="seoDescription" defaultValue={page.seoDescription || ''} />
                  <button className="btn-secondary w-fit">Update</button>
                </form>
                <form action="/api/admin/pages" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={page.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            ])}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
