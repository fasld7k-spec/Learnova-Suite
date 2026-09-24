import { absoluteUrl } from '@/lib/seo';
import { appUrlFromRequest } from '@/lib/app-url';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const baseUrl = appUrlFromRequest(req);
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api',
    'Disallow: /dashboard',
    'Disallow: /instructor',
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml', baseUrl)}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
