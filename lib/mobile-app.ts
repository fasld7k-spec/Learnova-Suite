import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export type PublicMobileAppLink = {
  platform: string;
  label: string;
  storeUrl: string;
  version: string;
  deepLinkScheme: string;
  universalLinks: string;
};

const labels: Record<string, string> = {
  ios: 'iOS App',
  android: 'Android App',
  pwa: 'PWA',
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function getPublicMobileAppLinks(): Promise<PublicMobileAppLink[]> {
  const rows = await prisma.mobileAppSetting.findMany({
    where: { active: true },
    orderBy: { platform: 'asc' },
  }).catch(() => []);

  return rows
    .map((row) => {
      const config = fromJsonObject<Record<string, unknown>>(row.config);
      return {
        platform: row.platform,
        label: labels[row.platform] || row.platform,
        storeUrl: text(config.storeUrl),
        version: text(config.version),
        deepLinkScheme: text(config.deepLinkScheme),
        universalLinks: text(config.universalLinks),
        status: text(config.status),
      };
    })
    .filter((row) => row.storeUrl && row.status !== 'disabled')
    .map(({ status, ...row }) => row);
}
