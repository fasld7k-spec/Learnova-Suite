export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ArrowRight, Newspaper, Timer } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, jsonLd, seo } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site-settings';
import { currentAppUrl } from '@/lib/request-url';

export const metadata = seo({
  title: 'Blog',
  description: 'Product updates, learning operations notes, marketplace guidance, and education business stories.',
  path: '/blog',
});

export default async function Blog() {
  const [posts, settings] = await Promise.all([
    prisma.blogPost.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } }),
    getSiteSettings()
  ]);
  const appUrl = await currentAppUrl(settings.publicAppUrl);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${settings.siteName} Blog`,
    description: metadata.description,
    url: absoluteUrl('/blog', appUrl),
    blogPost: posts.slice(0, 20).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      datePublished: post.createdAt.toISOString(),
      url: absoluteUrl(`/blog/${post.slug}`, appUrl),
      image: post.coverImage ? absoluteUrl(post.coverImage, appUrl) : undefined,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-8">
          <h1 className="text-5xl font-black text-white">Blog</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Product updates, learning operations notes, marketplace guidance, and education business stories.</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-5">
          {posts.length ? posts.map((post) => (
            <Link className="moe-panel moe-card-shine group block p-5 transition hover:-translate-y-0.5" key={post.id} href={`/blog/${post.slug}`}>
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <span className="moe-mini-icon h-12 w-12 shrink-0">
                  <Newspaper size={23} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                    <Timer size={14} />
                    {post.createdAt.toLocaleDateString()}
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-white">{post.title}</h2>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{post.excerpt}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-200 transition group-hover:gap-3">
                    Read article
                    <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </Link>
          )) : (
            <EmptyState title="No posts published" description="Published articles will appear here." />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
