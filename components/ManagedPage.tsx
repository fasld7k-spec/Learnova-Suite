import { ReactNode } from 'react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

type ManagedPageProps = {
  slug: string;
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export async function ManagedPage({ slug, eyebrow = 'Page', title, description, children }: ManagedPageProps) {
  const [page, settings] = await Promise.all([
    prisma.page.findUnique({ where: { slug } }).catch(() => null),
    getSiteSettings()
  ]);
  const resolvedTitle = page?.titleEn || title.replace(/\{\{siteName\}\}/g, settings.siteName);
  const resolvedDescription = (page?.seoDescription || description).replace(/\{\{siteName\}\}/g, settings.siteName);

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">{resolvedTitle}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{resolvedDescription}</p>
          </div>
        </section>
        {page?.bodyEn ? (
          <section className="page-shell mt-8">
            <div className="moe-panel whitespace-pre-wrap p-6 text-sm leading-7 text-slate-200">{page.bodyEn}</div>
          </section>
        ) : (
          children
        )}
      </main>
      <Footer />
    </>
  );
}
