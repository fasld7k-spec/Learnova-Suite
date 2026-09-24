import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export type EmbedSettings = {
  enabled: boolean;
  theme: 'dark' | 'light' | 'brand';
  width: number;
  height: number;
  ctaLabel: string;
  partnerNote: string;
  allowedDomains: string;
};

export const defaultEmbedSettings: EmbedSettings = {
  enabled: true,
  theme: 'dark',
  width: 360,
  height: 420,
  ctaLabel: 'View course',
  partnerNote: 'Embeds are optimized for partner pages, blogs, and landing pages.',
  allowedDomains: '*',
};

function numberRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeEmbedSettings(input: Partial<EmbedSettings>): EmbedSettings {
  const theme = ['dark', 'light', 'brand'].includes(String(input.theme)) ? input.theme as EmbedSettings['theme'] : defaultEmbedSettings.theme;
  return {
    enabled: input.enabled !== false,
    theme,
    width: numberRange(input.width, defaultEmbedSettings.width, 240, 1200),
    height: numberRange(input.height, defaultEmbedSettings.height, 260, 1200),
    ctaLabel: String(input.ctaLabel || defaultEmbedSettings.ctaLabel).trim(),
    partnerNote: String(input.partnerNote || defaultEmbedSettings.partnerNote).trim(),
    allowedDomains: String(input.allowedDomains || defaultEmbedSettings.allowedDomains).trim(),
  };
}

export async function getEmbedSettings() {
  const row = await prisma.setting.findUnique({ where: { key: 'embed_widgets' } }).catch(() => null);
  return normalizeEmbedSettings(fromJsonObject<Partial<EmbedSettings>>(row?.value));
}

export async function saveEmbedSettings(settings: EmbedSettings) {
  await prisma.setting.upsert({
    where: { key: 'embed_widgets' },
    update: { value: toJson(settings) },
    create: { key: 'embed_widgets', value: toJson(settings) },
  });
}
