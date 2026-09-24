import { headers } from 'next/headers';

import { ClientTrackingScripts } from '@/components/ClientTrackingScripts';
import { getPublicTrackingIntegrations } from '@/lib/integrations';

const privateTrackingPrefixes = [
  '/admin',
  '/instructor',
  '/student',
  '/dashboard',
  '/learn',
  '/account',
  '/cart',
  '/checkout',
  '/messages',
  '/notifications',
  '/profile',
  '/invoice',
  '/calendar',
];

function shouldSkipTracking(pathname: string) {
  return privateTrackingPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function TrackingScripts() {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-learnova-pathname') || '';
  if (shouldSkipTracking(pathname)) return null;

  const { googleAnalyticsId, metaPixelId } = await getPublicTrackingIntegrations();

  if (!googleAnalyticsId && !metaPixelId) return null;
  return <ClientTrackingScripts googleAnalyticsId={googleAnalyticsId} metaPixelId={metaPixelId} />;
}
