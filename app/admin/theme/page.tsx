import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { homeThemeRegistry, parseHomeThemeId, type HomeThemeId, type HomeThemeSettings } from '@/lib/home-theme-registry';
import { localizedHomeThemes } from '@/lib/localized-copy';
import { getSiteSettings } from '@/lib/site-settings';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ThemeSystemCard } from '@/components/admin/HomeThemeControls';
import { CsrfInput } from '@/components/CsrfInput';

const themeIds = homeThemeRegistry.map((theme) => theme.id as HomeThemeId);

export default async function ThemeSettings(props: { searchParams?: Promise<{ saved?: string }> }) {
  await requireUser(['ADMIN']);
  const searchParams = await props.searchParams;
  const [s, settings] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'theme' } }),
    getSiteSettings()
  ]);
  const v = fromJsonObject<any>(s?.value);
  const savedThemes = fromJsonObject<Record<HomeThemeId, Partial<HomeThemeSettings>>>(v.homeThemes);
  const activeTheme = parseHomeThemeId(v.homeTheme);
  const defaults = localizedHomeThemes(settings.defaultLanguage);

  return (
    <DashboardShell role="admin" title="Theme Customizer">
      <div className="grid max-w-5xl gap-6">
        <section className="card grid gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Homepage theme systems</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#71767B]">Activate a homepage system from its card, or open a dedicated customization page for its text, visuals, hero image, and microcopy.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="btn-secondary min-h-9 px-4" href="/" target="_blank">
                Preview active theme
              </Link>
              <Link className="btn-secondary min-h-9 px-4" href="/admin/theme/global">
                Global tokens
              </Link>
              <form action="/api/admin/theme" method="post">
          <CsrfInput />
                <input type="hidden" name="resetAllThemes" value="1" />
                <button className="min-h-9 rounded-full border border-[#F4212E] px-4 text-sm font-black text-[#F4212E] transition hover:bg-[#F4212E]/10" type="submit">
                  Reset all themes
                </button>
              </form>
            </div>
          </div>
          {searchParams?.saved && (
            <p className="border border-[#1D9BF0] bg-[#06111a] p-3 text-sm font-bold text-[#1D9BF0]">
              Theme changes saved.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {themeIds.map((id) => (
              <ThemeSystemCard key={id} id={id} active={activeTheme === id} value={savedThemes[id]} defaults={defaults} />
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
