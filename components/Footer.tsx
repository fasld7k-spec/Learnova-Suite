import Link from 'next/link';
import { localizedCopy } from '@/lib/localized-copy';
import { getPublicMobileAppLinks } from '@/lib/mobile-app';
import { getSiteSettings } from '@/lib/site-settings';

export async function Footer() {
  const [settings, mobileLinks] = await Promise.all([
    getSiteSettings(),
    getPublicMobileAppLinks(),
  ]);
  const copy = localizedCopy(settings.defaultLanguage);

  return (
    <footer className="mt-24 border-t border-[#2A3037] bg-[#050607] py-10 text-sm">
      <div className="page-shell flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <p className="font-black text-white">{settings.siteName}</p>
          <p className="mt-1 leading-6 text-[#8A949E]">Copyright {new Date().getFullYear()} {copy.site.copyright}</p>
          <p className="mt-1 leading-6 text-[#8A949E]">{settings.supportEmail} {settings.supportPhone ? `/ ${settings.supportPhone}` : ''}</p>
          {settings.footerNote ? <p className="mt-2 leading-6 text-[#8A949E]">{settings.footerNote}</p> : null}
        </div>
        <nav className="flex flex-wrap gap-2 text-[#8A949E]" aria-label={copy.common.footerNavigation}>
          <Link href="/documentation" className="rounded-full px-3 py-2 font-semibold transition hover:bg-[#101317] hover:text-[#79C7FF]">
            Documentation
          </Link>
          {settings.footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-full px-3 py-2 font-semibold transition hover:bg-[#101317] hover:text-[#79C7FF]">
              {link.label}
            </Link>
          ))}
          {settings.socialLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-full px-3 py-2 font-semibold transition hover:bg-[#101317] hover:text-[#79C7FF]">
              {link.label}
            </Link>
          ))}
          {mobileLinks.map((link) => (
            <Link key={link.platform} href={link.storeUrl} className="rounded-full px-3 py-2 font-semibold transition hover:bg-[#101317] hover:text-[#79C7FF]">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
