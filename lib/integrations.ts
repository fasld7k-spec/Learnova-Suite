import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export type PublicTrackingIntegrations = {
  googleAnalyticsId: string;
  metaPixelId: string;
};

function cleanTrackingId(value: unknown) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

export async function getPublicTrackingIntegrations(): Promise<PublicTrackingIntegrations> {
  const rows = await prisma.integrationSetting.findMany({
    where: {
      active: true,
      provider: { in: ['google_analytics', 'facebook_pixel'] },
    },
    select: { provider: true, config: true },
  }).catch(() => []);

  let googleAnalyticsId = '';
  let metaPixelId = '';

  for (const row of rows) {
    const config = fromJsonObject<Record<string, unknown>>(row.config);
    if (row.provider === 'google_analytics') {
      googleAnalyticsId = cleanTrackingId(config.measurementId || config.trackingId || config.propertyId);
    }
    if (row.provider === 'facebook_pixel') {
      metaPixelId = cleanTrackingId(config.pixelId || config.trackingId);
    }
  }

  return { googleAnalyticsId, metaPixelId };
}
