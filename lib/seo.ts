import type { Metadata } from 'next';
import { resolveAppUrl } from '@/lib/app-url';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export const siteName = 'Learnova Suite';
export const defaultDescription = 'SaaS marketplace for courses and live classes.';

export type SeoSettings = {
  defaultTitle: string;
  defaultDescription: string;
  ogImage: string;
  keywords: string[];
  robotsIndex: boolean;
  robotsFollow: boolean;
  twitterHandle: string;
};

function parseKeywords(value: unknown) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function getSeoSettings(fallback?: { siteName?: string; tagline?: string }): Promise<SeoSettings> {
  const row = await prisma.setting.findUnique({ where: { key: 'seo' } }).catch(() => null);
  const value = fromJsonObject<Record<string, unknown>>(row?.value);

  return {
    defaultTitle: String(value.defaultTitle || fallback?.siteName || siteName).trim(),
    defaultDescription: cleanDescription(String(value.defaultDescription || fallback?.tagline || defaultDescription)),
    ogImage: String(value.ogImage || '').trim(),
    keywords: parseKeywords(value.keywords),
    robotsIndex: value.robotsIndex !== 'false' && value.robotsIndex !== false,
    robotsFollow: value.robotsFollow !== 'false' && value.robotsFollow !== false,
    twitterHandle: String(value.twitterHandle || '').trim().replace(/^@/, ''),
  };
}

export function siteUrl(baseUrl?: string | null) {
  return resolveAppUrl({ configured: baseUrl });
}

export function absoluteUrl(path = '', baseUrl?: string | null) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

export function cleanDescription(value?: string | null, fallback = defaultDescription) {
  const text = String(value || fallback).replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 157).trim()}...` : text;
}

export function seo({
  title,
  description,
  path = '',
  image,
  type = 'website',
  baseUrl,
}: {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
  type?: 'website' | 'article';
  baseUrl?: string | null;
}): Metadata {
  const canonical = absoluteUrl(path, baseUrl);
  const metaDescription = cleanDescription(description);
  const images = image ? [{ url: absoluteUrl(image, baseUrl), alt: title }] : undefined;

  return {
    title,
    description: metaDescription,
    alternates: { canonical },
    openGraph: {
      title,
      description: metaDescription,
      url: canonical,
      siteName,
      type,
      images,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description: metaDescription,
      images: image ? [absoluteUrl(image, baseUrl)] : undefined,
    },
  };
}

export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
