import { CalendarDays } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, jsonLd, seo } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site-settings';
import { currentAppUrl } from '@/lib/request-url';
import { notFound } from 'next/navigation';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post || !post.published) {
    return seo({ title: 'Article not found', description: 'This article is not available.', path: `/blog/${params.slug}`, baseUrl: await currentAppUrl() });
  }

  return seo({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.coverImage,
    type: 'article',
    baseUrl: await currentAppUrl(),
  });
}

export default async function Post(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const [post, settings] = await Promise.all([
    prisma.blogPost.findUnique({ where: { slug: params.slug } }),
    getSiteSettings()
  ]);
  if (!post || !post.published) notFound();
  const appUrl = await currentAppUrl(settings.publicAppUrl);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    articleBody: post.content,
    datePublished: post.createdAt.toISOString(),
    dateModified: post.createdAt.toISOString(),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`, appUrl),
    image: post.coverImage ? absoluteUrl(post.coverImage, appUrl) : undefined,
    author: {
      '@type': 'Organization',
      name: settings.siteName,
    },
    publisher: {
      '@type': 'Organization',
      name: settings.siteName,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <Nav />
      <main className="moe-page py-12">
        <article className="mx-auto max-w-3xl">
          <header className="moe-panel-soft p-6 md:p-8">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
              <CalendarDays size={16} />
              {post.createdAt.toLocaleDateString()}
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-white md:text-5xl">{post.title}</h1>
            {post.excerpt && <p className="mt-5 text-lg leading-8 text-slate-300">{post.excerpt}</p>}
          </header>

          <div className="moe-panel mt-8 p-6 text-slate-100">
            <div className="whitespace-pre-wrap text-base leading-8">{post.content}</div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
