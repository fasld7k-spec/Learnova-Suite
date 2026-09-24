import Link from 'next/link';
import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function KnowledgeBaseArticle(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const article = await prisma.knowledgeBaseArticle.findUnique({ where: { slug: params.slug } });
  if (!article || !article.published) notFound();

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <article className="moe-panel mx-auto max-w-4xl p-6 sm:p-8">
          <Link className="inline-flex items-center gap-2 text-sm font-black text-violet-200" href="/knowledge-base">
            <ArrowLeft size={16} />
            Knowledge Base
          </Link>
          <div className="mt-8 flex flex-col gap-4 border-b border-violet-300/15 pb-8 sm:flex-row sm:items-start">
            <span className="moe-mini-icon h-12 w-12 shrink-0">
              <BookOpenCheck size={22} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-200">{article.category || 'Article'}</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">{article.title}</h1>
              <p className="mt-4 text-sm font-semibold text-slate-400">Published {article.createdAt.toLocaleDateString()}</p>
            </div>
          </div>
          <div className="prose prose-invert mt-8 max-w-none whitespace-pre-wrap text-base leading-8 text-slate-200">
            {article.body}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
