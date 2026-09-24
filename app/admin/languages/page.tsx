import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { languagePresets } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

const previewCopy: Record<string, { nav: string; cta: string }> = {
  en: { nav: 'Courses - Dashboard - Buy now', cta: 'Start learning today' },
  ar: { nav: 'الدورات - لوحة التحكم - اشتر الآن', cta: 'ابدأ التعلم اليوم' },
  fr: { nav: 'Cours - Tableau de bord - Acheter', cta: 'Commencer à apprendre' },
  es: { nav: 'Cursos - Panel - Comprar', cta: 'Empieza a aprender' },
  de: { nav: 'Kurse - Dashboard - Kaufen', cta: 'Jetzt lernen starten' },
  tr: { nav: 'Kurslar - Panel - Satın al', cta: 'Bugün öğrenmeye başla' },
  pt: { nav: 'Cursos - Painel - Comprar', cta: 'Comece a aprender hoje' },
};

function fallbackPreview(code: string) {
  return previewCopy[code] || { nav: 'Courses - Dashboard - Buy now', cta: 'Localized preview text' };
}

export default async function Languages() {
  await requireUser(['ADMIN']);
  const [rows, settings] = await Promise.all([
    prisma.language.findMany({ orderBy: [{ active: 'desc' }, { code: 'asc' }] }),
    getSiteSettings(),
  ]);
  const active = rows.find((language) => language.active);

  return (
    <DashboardShell role="admin" title="Languages">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{active?.code.toUpperCase() || settings.defaultLanguage.toUpperCase()}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Single active site language</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{settings.activeLanguageDirection.toUpperCase()}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Global page direction</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="text-3xl font-black text-white">{rows.length}/{languagePresets.length}</div>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Installed / built-in presets</p>
        </div>
      </div>

      <section className="mt-6 border border-[#2F3336] bg-black p-5">
        <h2 className="text-xl font-black text-white">Active language mode</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          The marketplace runs with one active language at a time. Visitors cannot switch languages from the frontend; the admin chooses the global language here.
          Navigation labels, page copy, and theme copy can still be customized from their admin modules for that chosen language.
        </p>
        <form className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]" action="/api/admin/languages" method="post">
          <CsrfInput />
          <input type="hidden" name="mode" value="activate" />
          <select className="input" name="activeLanguageCode" defaultValue={active?.code || settings.defaultLanguage}>
            {rows.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name} ({language.code.toUpperCase()} / {language.direction.toUpperCase()})
              </option>
            ))}
          </select>
          <button className="btn-primary">Set as only active language</button>
        </form>
        <form className="mt-3" action="/api/admin/languages" method="post">
          <CsrfInput />
          <input type="hidden" name="mode" value="sync-presets" />
          <button className="btn-secondary">Install or refresh built-in presets</button>
        </form>
      </section>

      <form className="card mt-6 grid gap-3 md:grid-cols-5" action="/api/admin/languages" method="post">
          <CsrfInput />
        <input type="hidden" name="mode" value="save" />
        <input className="input" name="code" placeholder="en" required />
        <input className="input" name="name" placeholder="English" required />
        <select className="input" name="direction" defaultValue="ltr">
          <option value="ltr">LTR</option>
          <option value="rtl">RTL</option>
        </select>
        <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
          <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="makeActive" /> Make active
        </label>
        <button className="btn-primary">Save Language</button>
      </form>

      {active && (
        <section dir={active.direction} className="mt-6 border border-[#2F3336] bg-black p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">{active.name} preview</h2>
            <Badge tone={active.direction === 'rtl' ? 'yellow' : 'green'}>{active.direction.toUpperCase()}</Badge>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#71767B]">{fallbackPreview(active.code).nav}</p>
          <p className="mt-3 text-2xl font-black text-white">{fallbackPreview(active.code).cta}</p>
        </section>
      )}

      <div className="mt-6">
        <DataTable
          headers={['Code', 'Name', 'Direction', 'Preview', 'Status', 'Manage']}
          rows={rows.map((language) => {
            const preview = fallbackPreview(language.code);
            return [
              <code key="code" className="font-bold uppercase text-white">{language.code}</code>,
              language.name,
              <Badge key="dir" tone={language.direction === 'rtl' ? 'yellow' : 'green'}>{language.direction.toUpperCase()}</Badge>,
              <span key="preview" dir={language.direction} className="block max-w-sm text-sm">{preview.cta}</span>,
              <Badge key="active" tone={language.active ? 'green' : 'slate'}>{language.active ? 'Site language' : 'Available'}</Badge>,
              <div key="manage" className="grid min-w-[300px] gap-2">
                <form className="grid gap-2" action="/api/admin/languages" method="post">
          <CsrfInput />
                  <input type="hidden" name="mode" value="save" />
                  <input type="hidden" name="code" value={language.code} />
                  <input className="input" name="name" defaultValue={language.name} aria-label={`${language.code} language name`} />
                  <select className="input" name="direction" defaultValue={language.direction} aria-label={`${language.code} direction`}>
                    <option value="ltr">LTR</option>
                    <option value="rtl">RTL</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#E7E9EA]">
                    <input type="checkbox" name="makeActive" defaultChecked={language.active} /> Set as site language
                  </label>
                  <button className="btn-secondary w-fit">Update Language</button>
                </form>
                {!language.active ? (
                  <form action="/api/admin/languages" method="post">
          <CsrfInput />
                    <input type="hidden" name="mode" value="delete" />
                    <input type="hidden" name="code" value={language.code} />
                    <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                  </form>
                ) : null}
              </div>,
            ];
          })}
        />
      </div>
    </DashboardShell>
  );
}
