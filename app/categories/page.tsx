export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowRight, FolderOpen, Layers3 } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { localizedPageCopy } from '@/lib/page-copy';
import { absoluteUrl, jsonLd, seo } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site-settings';
import { currentAppUrl } from '@/lib/request-url';

export const metadata = seo({
  title: 'Categories',
  description: 'Browse course categories by subject area, discipline, or professional focus.',
  path: '/categories',
});

export default async function Categories() {
  const [categories, settings] = await Promise.all([
    prisma.category.findMany({
      include: { courses: { where: { status: 'PUBLISHED' }, select: { id: true } } },
      orderBy: { nameEn: 'asc' },
    }),
    getSiteSettings(),
  ]);
  const copy = localizedPageCopy(settings.defaultLanguage).catalog;
  const appUrl = await currentAppUrl(settings.publicAppUrl);
  const categoryName = (category: { nameEn: string; nameAr: string | null }) =>
    settings.rtl ? category.nameAr || category.nameEn : category.nameEn || category.nameAr || copy.courseFallback;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: copy.categoriesTitle,
    description: metadata.description,
    url: absoluteUrl('/categories', appUrl),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: categories.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: categoryName(category),
        url: absoluteUrl(`/categories/${category.slug}`, appUrl),
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <h1 className="text-5xl font-black text-white">{copy.categoriesTitle}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">{copy.categoriesSubtitle}</p>
          </div>
          <span className="moe-control px-4 py-3 text-sm font-bold text-slate-200">
            {categories.length} {copy.categoriesCount}
          </span>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {categories.length ? categories.map((category) => (
            <Link className="moe-panel moe-card-shine group p-5 transition hover:-translate-y-0.5" href={`/categories/${category.slug}`} key={category.id}>
              <div className="flex items-start justify-between gap-4">
                <span className="moe-mini-icon">
                  <FolderOpen size={21} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-violet-300/20 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-300">
                  <Layers3 size={13} />
                  {category.courses.length} {copy.coursesCount}
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-black text-white">{categoryName(category)}</h2>
              {!settings.rtl && category.nameAr && <p className="mt-2 text-sm font-semibold text-slate-400">{category.nameAr}</p>}
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition group-hover:gap-3">
                {copy.browseCategory}
                <ArrowRight size={16} />
              </span>
            </Link>
          )) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title={copy.noCategoriesTitle} description={copy.noCategoriesBody} />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
