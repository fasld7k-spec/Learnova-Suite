import { fromJsonObject } from '@/lib/json-fields';
import { defaultHomeThemes, homeThemeIds, parseHomeThemeId, type HomeThemeId, type HomeThemeSettings } from '@/lib/home-theme-registry';
import { footerLinksByLocale, localizedCopy, localizedHomeThemes, navLinksByLocale, normalizeLocale } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/secret-fields';
import { getCached } from '@/lib/cache';
import { configuredAppUrl, normalizeAppUrl } from '@/lib/app-url';

export type SiteLink = { href: string; label: string };
export { defaultHomeThemes, homeThemeIds, parseHomeThemeId };
export type { HomeThemeId, HomeThemeSettings };

export type SiteSettings = {
  siteName: string;
  tagline: string;
  officialEmail: string;
  supportEmail: string;
  supportPhone: string;
  publicAppUrl: string;
  logoUrl: string;
  faviconUrl: string;
  currency: string;
  defaultLanguage: string;
  activeLanguageName: string;
  activeLanguageDirection: 'ltr' | 'rtl';
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  foregroundColor: string;
  mutedColor: string;
  borderColor: string;
  panelColor: string;
  panelStrongColor: string;
  brandStrongColor: string;
  brandSoftColor: string;
  buttonTextColor: string;
  rtl: boolean;
  registrationEnabled: boolean;
  instructorsEnabled: boolean;
  platformCommission: number;
  certificateIssuer: string;
  certificatePrefix: string;
  socialLinks: SiteLink[];
  navLinks: SiteLink[];
  footerLinks: SiteLink[];
  footerNote: string;
  paymentNotes: string;
  emailProvider: string;
  smtpSender: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  smtpStartTls: boolean;
  smtpEhloDomain: string;
  aiEnabled: boolean;
  aiAssistantEnabled: boolean;
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiEndpoint: string;
  storageProvider: string;
  storageBucket: string;
  storageAccessKeyId: string;
  storageSecretAccessKey: string;
  storageRegion: string;
  storageEndpoint: string;
  storagePublicBaseUrl: string;
  allowLocalUploads: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  githubClientId?: string;
  githubClientSecret?: string;
  githubRedirectUri?: string;
  facebookClientId: string;
  facebookClientSecret: string;
  facebookRedirectUri: string;
  fontFamily: string;
  radius: string;
  homeTheme: HomeThemeId;
  homeThemes: Record<HomeThemeId, HomeThemeSettings>;
};

function parseHomeThemes(value: unknown, fallbackThemes: Record<HomeThemeId, HomeThemeSettings>): Record<HomeThemeId, HomeThemeSettings> {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

  return homeThemeIds.reduce((themes, id) => {
    const incoming = raw[id] && typeof raw[id] === 'object' && !Array.isArray(raw[id]) ? raw[id] as Partial<HomeThemeSettings> : {};
    const incomingText = Object.fromEntries(
      Object.entries(incoming).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : String(item ?? '')])
    ) as Record<string, string>;
    themes[id] = {
      ...defaultHomeThemes[id],
      ...fallbackThemes[id],
      ...incomingText
    } as HomeThemeSettings;
    return themes;
  }, {} as Record<HomeThemeId, HomeThemeSettings>);
}

export const defaultNavLinks: SiteLink[] = navLinksByLocale.en;

export const defaultFooterLinks: SiteLink[] = footerLinksByLocale.en;

function parseLinks(value: unknown, fallback: SiteLink[]) {
  if (Array.isArray(value)) {
    const links = value
      .map((item) => ({ href: String(item?.href || '').trim(), label: String(item?.label || '').trim() }))
      .filter((item) => item.href && item.label);
    return links.length ? links : fallback;
  }

  const text = String(value || '').trim();
  if (!text) return fallback;
  const links = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...hrefParts] = line.split('=');
      return { label: label.trim(), href: hrefParts.join('=').trim() };
    })
    .filter((item) => item.href && item.label);
  return links.length ? links : fallback;
}

export function linksToText(links: SiteLink[]) {
  return links.map((link) => `${link.label}=${link.href}`).join('\n');
}

export function formatMoney(value: unknown, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function providerEnvAiKey(provider: string) {
  const normalized = provider.toLowerCase();
  if (normalized === 'openrouter') return process.env.OPENROUTER_API_KEY || '';
  if (normalized === 'deepseek') return process.env.DEEPSEEK_API_KEY || '';
  if (normalized === 'openai') return process.env.OPENAI_API_KEY || '';
  return '';
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return getCached('site:settings', () => fetchSiteSettings(), { ttlSeconds: 60, staleSeconds: 120, tags: ['settings', 'site', 'theme'] });
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const [generalRow, whiteLabelRow, themeRow, activeLanguageRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'general' } }),
    prisma.setting.findUnique({ where: { key: 'white_label' } }),
    prisma.setting.findUnique({ where: { key: 'theme' } }),
    prisma.language.findFirst({ where: { active: true }, orderBy: { code: 'asc' } }).catch(() => null)
  ]);
  const general = fromJsonObject<any>(generalRow?.value);
  const whiteLabel = fromJsonObject<any>(whiteLabelRow?.value);
  const theme = fromJsonObject<any>(themeRow?.value);
  const siteName = whiteLabel.brandName || general.siteName || 'Learnova Suite';
  const defaultLanguage = activeLanguageRow?.code || general.defaultLanguage || 'en';
  const activeLanguageDirection = (activeLanguageRow?.direction || (general.rtl ? 'rtl' : 'ltr')) === 'rtl' ? 'rtl' : 'ltr';
  const locale = normalizeLocale(defaultLanguage);
  const copy = localizedCopy(locale);
  const fallbackHomeThemes = localizedHomeThemes(locale);
  const aiProvider = general.aiProvider || process.env.AI_PROVIDER || 'demo';
  const aiApiKey = decryptSecret(general.aiApiKey) || providerEnvAiKey(aiProvider);

  return {
    siteName,
    tagline: general.tagline || copy.site.tagline,
    officialEmail: general.officialEmail || process.env.SMTP_FROM || 'support@your-domain.com',
    supportEmail: whiteLabel.supportEmail || general.supportEmail || process.env.SMTP_FROM || 'support@your-domain.com',
    supportPhone: general.supportPhone || '+1 555 0100',
    publicAppUrl: normalizeAppUrl(general.publicAppUrl) || configuredAppUrl(),
    logoUrl: whiteLabel.logoUrl || general.logoUrl || '',
    faviconUrl: whiteLabel.faviconUrl || general.faviconUrl || '/icon.svg',
    currency: String(general.currency || 'USD').toUpperCase(),
    defaultLanguage,
    activeLanguageName: activeLanguageRow?.name || defaultLanguage.toUpperCase(),
    activeLanguageDirection,
    primaryColor: theme.primary || general.primaryColor || '#1D9BF0',
    secondaryColor: theme.secondary || '#16181C',
    backgroundColor: theme.background || '#000000',
    foregroundColor: theme.foreground || '#FFFFFF',
    mutedColor: theme.muted || '#71767B',
    borderColor: theme.border || '#2F3336',
    panelColor: theme.panel || '#000000',
    panelStrongColor: theme.panelStrong || theme.secondary || '#16181C',
    brandStrongColor: theme.brandStrong || theme.primary || general.primaryColor || '#1A8CD8',
    brandSoftColor: theme.brandSoft || 'rgba(29, 155, 240, 0.14)',
    buttonTextColor: theme.buttonText || '#FFFFFF',
    rtl: activeLanguageDirection === 'rtl',
    registrationEnabled: general.registrationEnabled ?? true,
    instructorsEnabled: general.instructorsEnabled ?? true,
    platformCommission: Math.min(100, Math.max(0, Number(general.platformCommission ?? 15))),
    certificateIssuer: general.certificateIssuer || siteName,
    certificatePrefix: general.certificatePrefix || 'CERT',
    socialLinks: parseLinks(general.socialLinks, []),
    navLinks: parseLinks(general.navLinks, navLinksByLocale[locale]),
    footerLinks: parseLinks(general.footerLinks, footerLinksByLocale[locale]),
    footerNote: whiteLabel.footerNote || general.footerNote || '',
    paymentNotes: general.paymentNotes || copy.site.paymentNotes,
    emailProvider: general.emailProvider || 'smtp',
    smtpSender: general.smtpSender || process.env.SMTP_FROM || process.env.SMTP_SENDER || 'no-reply@example.com',
    smtpHost: general.smtpHost || process.env.SMTP_HOST || '',
    smtpPort: Number(general.smtpPort || process.env.SMTP_PORT || (general.smtpSecure || process.env.SMTP_SECURE === 'true' ? 465 : 587)),
    smtpUser: general.smtpUser || process.env.SMTP_USER || '',
    smtpPassword: decryptSecret(general.smtpPassword) || process.env.SMTP_PASS || '',
    smtpSecure: general.smtpSecure ?? process.env.SMTP_SECURE === 'true',
    smtpStartTls: general.smtpStartTls ?? process.env.SMTP_STARTTLS !== 'false',
    smtpEhloDomain: general.smtpEhloDomain || process.env.SMTP_EHLO_DOMAIN || 'localhost',
    aiEnabled: general.aiEnabled ?? Boolean(aiApiKey),
    aiAssistantEnabled: general.aiAssistantEnabled ?? process.env.AI_ASSISTANT_ENABLED !== 'false',
    aiProvider,
    aiApiKey,
    aiModel: general.aiModel || process.env.AI_MODEL || 'gpt-4o-mini',
    aiEndpoint: general.aiEndpoint || process.env.AI_ENDPOINT || '',
    storageProvider: general.storageProvider || process.env.STORAGE_PROVIDER || 'local',
    storageBucket: general.storageBucket || process.env.S3_BUCKET || '',
    storageAccessKeyId: general.storageAccessKeyId || process.env.S3_ACCESS_KEY_ID || '',
    storageSecretAccessKey: decryptSecret(general.storageSecretAccessKey) || process.env.S3_SECRET_ACCESS_KEY || '',
    storageRegion: general.storageRegion || process.env.S3_REGION || 'auto',
    storageEndpoint: general.storageEndpoint || process.env.S3_ENDPOINT || '',
    storagePublicBaseUrl: general.storagePublicBaseUrl || process.env.S3_PUBLIC_BASE_URL || '',
    allowLocalUploads: general.allowLocalUploads ?? process.env.ALLOW_LOCAL_UPLOADS === 'true',
    googleClientId: general.googleClientId || process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: decryptSecret(general.googleClientSecret) || process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: general.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI || '',
    githubClientId: general.githubClientId || process.env.GITHUB_CLIENT_ID || '',
    githubClientSecret: decryptSecret(general.githubClientSecret) || process.env.GITHUB_CLIENT_SECRET || '',
    githubRedirectUri: general.githubRedirectUri || process.env.GITHUB_REDIRECT_URI || '',
    facebookClientId: general.facebookClientId || process.env.FACEBOOK_CLIENT_ID || '',
    facebookClientSecret: decryptSecret(general.facebookClientSecret) || process.env.FACEBOOK_CLIENT_SECRET || '',
    facebookRedirectUri: general.facebookRedirectUri || process.env.FACEBOOK_REDIRECT_URI || '',
    fontFamily: theme.font || 'Chirp, Inter, Roboto, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    radius: theme.radius || '9999px',
    homeTheme: parseHomeThemeId(theme.homeTheme),
    homeThemes: parseHomeThemes(theme.homeThemes, fallbackHomeThemes)
  };
}
