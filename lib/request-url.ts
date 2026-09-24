import { headers } from 'next/headers';
import { resolveAppUrl } from '@/lib/app-url';

export async function currentAppUrl(configured?: string | null) {
  const requestHeaders = await headers();
  return resolveAppUrl({ configured, headers: requestHeaders });
}
