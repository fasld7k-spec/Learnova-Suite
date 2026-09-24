import './globals.css';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ThemeScript } from '@/components/ThemeScript';
import { getSeoSettings, siteUrl } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site-settings';
import { currentAppUrl } from '@/lib/request-url';
import { SmartAssistantWidget } from '@/components/ai/SmartAssistantWidget';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { TrackingScripts } from '@/components/TrackingScripts';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const seo = await getSeoSettings({ siteName: settings.siteName, tagline: settings.tagline });
  const appUrl = await currentAppUrl(settings.publicAppUrl);
  const image = seo.ogImage ? [{ url: seo.ogImage, alt: seo.defaultTitle || settings.siteName }] : undefined;
  return {
    metadataBase: new URL(siteUrl(appUrl)),
    title: {
      default: seo.defaultTitle || settings.siteName,
      template: `%s | ${settings.siteName}`,
    },
    description: seo.defaultDescription,
    keywords: seo.keywords.length ? seo.keywords : undefined,
    applicationName: settings.siteName,
    icons: {
      icon: settings.faviconUrl || '/icon.svg'
    },
    robots: {
      index: seo.robotsIndex,
      follow: seo.robotsFollow,
    },
    openGraph: {
      title: seo.defaultTitle || settings.siteName,
      description: seo.defaultDescription,
      siteName: settings.siteName,
      type: 'website',
      images: image,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: seo.defaultTitle || settings.siteName,
      description: seo.defaultDescription,
      site: seo.twitterHandle ? `@${seo.twitterHandle}` : undefined,
      creator: seo.twitterHandle ? `@${seo.twitterHandle}` : undefined,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang={settings.defaultLanguage} dir={settings.activeLanguageDirection} className="dark" suppressHydrationWarning>
      <body
        style={{
          '--brand': settings.primaryColor,
          '--brand-strong': settings.brandStrongColor,
          '--brand-soft': settings.brandSoftColor,
          '--accent': settings.primaryColor,
          '--background': settings.backgroundColor,
          '--foreground': settings.foregroundColor,
          '--muted': settings.mutedColor,
          '--border': settings.borderColor,
          '--panel': settings.panelColor,
          '--panel-strong': settings.panelStrongColor,
          '--button-text': settings.buttonTextColor,
          '--radius': settings.radius,
          backgroundColor: settings.backgroundColor,
          color: settings.foregroundColor,
          fontFamily: settings.fontFamily
        } as CSSProperties}
      >
        <ThemeScript />
        {children}
        {settings.aiAssistantEnabled && <SmartAssistantWidget siteName={settings.siteName} locale={settings.defaultLanguage} />}
        <CookieConsentBanner locale={settings.defaultLanguage} />
        <TrackingScripts />
      </body>
    </html>
  );
}
