import Link from 'next/link';
import { ArrowRight, BookOpenCheck, FileQuestion, SearchCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBase({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const query = (resolvedSearchParams?.q || '').trim();
  const normalizedQuery = query.toLowerCase();
  const rows = await prisma.knowledgeBaseArticle.findMany({
    where: { published: true },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  });
  const visibleRows = normalizedQuery
    ? rows.filter((article) =>
        [article.title, article.category, article.body]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      )
    : rows;
  const categories = Array.from(new Set(rows.map((article) => article.category).filter(Boolean)));

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_340px]">
          <div>
            <span className="moe-mini-icon h-12 w-12">
              <BookOpenCheck size={23} />
            </span>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-violet-300">Support library</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">Knowledge Base</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Practical articles for buyers, admins, instructors, and students covering setup, course delivery, checkout, certificates, and account workflows.
            </p>
            <form className="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row" action="/knowledge-base">
              <label className="moe-control flex h-12 flex-1 items-center gap-3 px-4">
                <SearchCheck size={17} className="shrink-0 text-slate-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
                  name="q"
                  defaultValue={query}
                  placeholder="Search help articles..."
                  aria-label="Search help articles"
                />
              </label>
              <button className="moe-primary inline-flex h-12 items-center justify-center rounded-lg px-5 text-sm font-black" type="submit">
                Search
              </button>
              {query ? (
                <Link className="moe-control inline-flex h-12 items-center justify-center px-5 text-sm font-black text-white" href="/knowledge-base">
                  Clear
                </Link>
              ) : null}
            </form>
          </div>
          <aside className="moe-panel grid content-center gap-3 p-5">
            <div className="flex items-center gap-3">
              <SearchCheck className="text-violet-300" size={20} />
              <div>
                <p className="text-2xl font-black text-white">{visibleRows.length}</p>
                <p className="text-sm font-semibold text-slate-400">{query ? 'Matching articles' : 'Published articles'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.length ? categories.slice(0, 6).map((category) => (
                <span className="rounded-full border border-violet-300/15 px-3 py-1 text-xs font-bold text-slate-200" key={category}>
                  {category}
                </span>
              )) : <span className="text-sm text-slate-400">No categories yet</span>}
            </div>
          </aside>
        </div>
        </section>

        {visibleRows.length ? (
          <section className="page-shell mt-8 grid gap-4 md:grid-cols-2">
            {visibleRows.map((article) => (
              <Link className="moe-panel moe-card-shine group flex min-h-44 flex-col justify-between p-5 transition hover:-translate-y-0.5" href={`/knowledge-base/${article.slug}`} key={article.id}>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-300">{article.category || 'Article'}</p>
                  <h2 className="mt-3 text-2xl font-black leading-tight text-white">{article.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{article.body}</p>
                </div>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-200 transition group-hover:gap-3">
                  Read article
                  <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </section>
        ) : (
          <section className="page-shell mt-8">
          <div className="moe-panel p-10 text-center">
            <FileQuestion className="mx-auto text-slate-400" size={38} />
            <h2 className="mt-4 text-2xl font-black text-white">{query ? 'No articles match your search' : 'No help articles published yet'}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-300">
              {query ? 'Try a broader keyword or open the support desk for a direct answer.' : 'Admins can publish setup, checkout, certificate, and learning articles from the admin knowledge-base manager.'}
            </p>
            <Link className="moe-control mt-6 inline-flex h-11 items-center px-5 text-sm font-bold text-white" href="/help">Open Help Center</Link>
          </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
