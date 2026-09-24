import { FileText } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function StaticPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const page = await prisma.page.findUnique({ where: { slug: params.slug } });
  if (!page) notFound();

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <article className="mx-auto max-w-4xl px-4">
          <div className="moe-panel-soft p-6 md:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <FileText size={23} />
            </span>
            <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl">{page.titleEn}</h1>
          </div>
          <div className="moe-panel mt-8 whitespace-pre-wrap p-6 text-sm leading-7 text-slate-200 md:p-8">
            {page.bodyEn}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
