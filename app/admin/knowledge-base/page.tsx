import Link from 'next/link';
import { BookOpen, FileText, Globe2, PencilLine } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';

function readingTime(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 220));
}

export default async function KBAdmin() {
  await requireUser(['ADMIN']);

  const rows = await prisma.knowledgeBaseArticle.findMany({ orderBy: { createdAt: 'desc' } });
  const published = rows.filter((article) => article.published).length;
  const drafts = rows.length - published;
  const categories = new Set(rows.map((article) => article.category.trim()).filter(Boolean)).size;

  return (
    <DashboardShell role="admin" title="Knowledge Base">
      <section className="ui-panel mb-6 overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2A3037] bg-[#101317] text-[#79C7FF]">
              <BookOpen size={22} strokeWidth={1.8} />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#79C7FF]">Support content</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Publish buyer-ready help articles</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8A949E]">
              Keep setup, checkout, live classes, and certificate guidance polished from one admin workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: 'Published', value: published, icon: Globe2, tone: 'text-[#5EE4B3]' },
              { label: 'Drafts', value: drafts, icon: PencilLine, tone: 'text-[#FFE36E]' },
              { label: 'Categories', value: categories, icon: FileText, tone: 'text-[#79C7FF]' }
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div className="ui-panel-muted flex items-center justify-between gap-4 p-4" key={stat.label}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#8A949E]">{stat.label}</p>
                    <p className="mt-1 text-2xl font-black text-white">{stat.value}</p>
                  </div>
                  <Icon className={stat.tone} size={20} strokeWidth={1.8} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="ui-panel grid gap-4 p-5" action="/api/admin/knowledge-base" method="post">
          <CsrfInput />
          <div>
            <p className="text-sm font-black text-[#79C7FF]">New article</p>
            <h3 className="mt-1 text-xl font-black text-white">Create or update by slug</h3>
            <p className="mt-2 text-sm leading-6 text-[#8A949E]">
              Reusing an existing slug updates the article, which keeps public links stable.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
            Title
            <input className="input" name="title" placeholder="Test checkout before launch" required />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
              Slug
              <input className="input" name="slug" placeholder="test-checkout-before-launch" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
              Category
              <input className="input" name="category" placeholder="Payments" required />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-[#D7DEE4]">
            Article body
            <textarea
              className="input min-h-56 leading-6"
              name="body"
              placeholder="Write clear setup steps, expected outcomes, and troubleshooting notes."
              required
            />
          </label>

          <div className="flex flex-col gap-4 border-t border-[#2A3037] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm font-bold text-[#D7DEE4]">
              <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="published" defaultChecked />
              Published
            </label>
            <button className="btn-primary w-full sm:w-fit">Save Article</button>
          </div>
        </form>

        <section className="min-w-0">
          {rows.length > 0 ? (
            <DataTable
              headers={['Article', 'Category', 'Status', 'Read', 'Date', 'Manage']}
              rows={rows.map((article) => [
                <div className="space-y-1" key={`${article.id}-title`}>
                  <Link className="font-black text-white transition hover:text-[#79C7FF]" href={`/knowledge-base/${article.slug}`}>
                    {article.title}
                  </Link>
                  <p className="break-all text-xs text-[#8A949E]">/{article.slug}</p>
                </div>,
                article.category,
                <Badge key={`${article.id}-status`} tone={article.published ? 'green' : 'yellow'}>
                  {article.published ? 'Published' : 'Draft'}
                </Badge>,
                `${readingTime(article.body)} min`,
                article.createdAt.toLocaleDateString(),
                <div key={`${article.id}-manage`} className="grid min-w-[360px] gap-3">
                  <details>
                    <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit article</summary>
                    <form className="mt-3 grid gap-2" action="/api/admin/knowledge-base" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="update" />
                      <input type="hidden" name="id" value={article.id} />
                      <input className="input" name="title" defaultValue={article.title} required />
                      <input className="input" name="slug" defaultValue={article.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
                      <input className="input" name="category" defaultValue={article.category} required />
                      <textarea className="input min-h-40 leading-6" name="body" defaultValue={article.body} required />
                      <label className="flex items-center gap-2 text-sm font-bold text-[#D7DEE4]">
                        <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="published" defaultChecked={article.published} />
                        Published
                      </label>
                      <button className="btn-primary w-fit">Save changes</button>
                    </form>
                  </details>
                  <div className="flex flex-wrap gap-2">
                    <form action="/api/admin/knowledge-base" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="toggle" />
                      <input type="hidden" name="id" value={article.id} />
                      <button className="btn-secondary">{article.published ? 'Unpublish' : 'Publish'}</button>
                    </form>
                    <form action="/api/admin/knowledge-base" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="id" value={article.id} />
                      <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                    </form>
                  </div>
                </div>
              ])}
            />
          ) : (
            <div className="ui-panel p-6 text-center">
              <FileText className="mx-auto text-[#79C7FF]" size={26} strokeWidth={1.8} />
              <h3 className="mt-4 text-lg font-black text-white">No help articles yet</h3>
              <p className="mt-2 text-sm text-[#8A949E]">Create the first article to make the public Knowledge Base feel complete.</p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
