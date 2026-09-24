import { ok, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const settings = await getSiteSettings();
    return ok({ status: 'ok', database: 'connected', time: new Date().toISOString(), app: settings.siteName });
  } catch (error: any) {
    return fail('Health check failed', 503, { database: 'unavailable', reason: error?.message });
  }
}
