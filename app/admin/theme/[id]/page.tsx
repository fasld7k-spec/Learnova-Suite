import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { getHomeThemeDefinition, isHomeThemeId, parseHomeThemeId, type HomeThemeId, type HomeThemeSettings } from '@/lib/home-theme-registry';
import { localizedHomeThemes } from '@/lib/localized-copy';
import { getSiteSettings } from '@/lib/site-settings';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { fieldValue, ThemeEditorFields } from '@/components/admin/HomeThemeControls';
import { CsrfInput } from '@/components/CsrfInput';

export default async function ThemeCustomizePage(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ saved?: string }> }) {
  await requireUser(['ADMIN']);
  const [{ id: rawId }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isHomeThemeId(rawId)) notFound();
  const id = rawId as HomeThemeId;
  const [s, settings] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'theme' } }),
    getSiteSettings()
  ]);
  const v = fromJsonObject<any>(s?.value);
  const savedThemes = fromJsonObject<Record<HomeThemeId, Partial<HomeThemeSettings>>>(v.homeThemes);
  const activeTheme = parseHomeThemeId(v.homeTheme);
  const defaults = localizedHomeThemes(settings.defaultLanguage);
  const definition = getHomeThemeDefinition(id);
  const value = savedThemes[id];

  return (
    <DashboardShell role="admin" title={`Customize ${fieldValue(value, id, 'name', defaults)}`}>
      <form className="grid max-w-5xl gap-6" action="/api/admin/theme" method="post" encType="multipart/form-data">
          <CsrfInput />
        <input type="hidden" name="themeId" value={id} />

        <section className="card grid gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <Link className="text-sm font-bold text-[#1D9BF0]" href="/admin/theme">Back to themes</Link>
              <h2 className="mt-3 text-2xl font-black text-white">{fieldValue(value, id, 'name', defaults)}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">{definition.adminSummary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#2F3336] px-3 py-1 text-xs font-bold text-white">{definition.layout}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${activeTheme === id ? 'border-[#1D9BF0] text-[#1D9BF0]' : 'border-[#2F3336] text-[#71767B]'}`}>
                  {activeTheme === id ? 'Active theme' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTheme !== id && (
                <button className="btn-primary min-h-9 px-4" name="homeTheme" value={id} type="submit">
                  Save and activate
                </button>
              )}
              <Link className="btn-secondary min-h-9 px-4" href={`/?previewTheme=${id}`} target="_blank">
                Preview
              </Link>
            </div>
          </div>
          {searchParams?.saved && (
            <p className="border border-[#1D9BF0] bg-[#06111a] p-3 text-sm font-bold text-[#1D9BF0]">Theme settings saved.</p>
          )}
        </section>

        <ThemeEditorFields id={id} value={value} defaults={defaults} />

        <div className="sticky bottom-4 flex justify-end border border-[#2F3336] bg-black/95 p-4">
          <button className="btn-primary">Save Theme</button>
        </div>
      </form>
    </DashboardShell>
  );
}
