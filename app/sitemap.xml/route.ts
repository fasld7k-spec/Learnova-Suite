import { prisma } from '@/lib/prisma';
import { absoluteUrl } from '@/lib/seo';
import { appUrlFromRequest } from '@/lib/app-url';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(path: string, baseUrl: string, lastModified?: Date, priority = '0.7') {
  return [
    '  <url>',
    `    <loc>${escapeXml(absoluteUrl(path, baseUrl))}</loc>`,
    lastModified ? `    <lastmod>${lastModified.toISOString()}</lastmod>` : '',
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n');
}

export async function GET(req: NextRequest) {
  const baseUrl = appUrlFromRequest(req);
  const [courses, posts, categories] = await Promise.all([
    prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.category.findMany({
      select: { slug: true, createdAt: true },
      orderBy: { nameEn: 'asc' },
    }),
  ]);

  const entries = [
    urlEntry('/', baseUrl, undefined, '1.0'),
    urlEntry('/courses', baseUrl, undefined, '0.9'),
    urlEntry('/categories', baseUrl, undefined, '0.8'),
    urlEntry('/blog', baseUrl, undefined, '0.8'),
    urlEntry('/documentation', baseUrl, undefined, '0.8'),
    urlEntry('/help', baseUrl, undefined, '0.7'),
    ...courses.map((course) => urlEntry(`/courses/${course.slug}`, baseUrl, course.updatedAt, '0.8')),
    ...categories.map((category) => urlEntry(`/categories/${category.slug}`, baseUrl, category.createdAt, '0.7')),
    ...posts.map((post) => urlEntry(`/blog/${post.slug}`, baseUrl, post.createdAt, '0.7')),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
