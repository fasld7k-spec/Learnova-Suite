import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CsrfInput } from '@/components/CsrfInput';
import { defaultHomeThemes, getHomeThemeDefinition, type HomeThemeId, type HomeThemeSettings } from '@/lib/home-theme-registry';

export const mainCopyFields = new Set([
  'name',
  'description',
  'heroTitle',
  'heroSubtitle',
  'primaryCtaLabel',
  'primaryCtaUrl',
  'secondaryCtaLabel',
  'secondaryCtaUrl',
  'featuredTitle',
  'featuredSubtitle',
  'panelTitle',
  'panelSubtitle',
  'searchPlaceholder',
  'recommendedTitle',
  'recommendedSubtitle'
]);

export const themeVisualFields = [
  ['accentColor', 'Accent color'],
  ['accentStrongColor', 'Accent hover color'],
  ['accentSoftColor', 'Accent soft tint'],
  ['backgroundColor', 'Homepage background'],
  ['surfaceColor', 'Homepage surface'],
  ['surfaceAltColor', 'Alternate surface'],
  ['textColor', 'Homepage text'],
  ['mutedTextColor', 'Muted text'],
  ['borderColor', 'Border color'],
  ['buttonTextColor', 'Primary button text'],
  ['fontFamily', 'Body font stack'],
  ['fontDisplay', 'Display font stack'],
  ['radius', 'Control radius'],
  ['radiusCard', 'Panel/card radius'],
  ['shadow', 'Theme elevation shadow'],
  ['heroImageUrl', 'Hero image URL'],
  ['heroImageAlt', 'Hero image alt text'],
  ['heroOverlayColor', 'Hero overlay color'],
  ['heroOverlayOpacity', 'Hero overlay opacity']
] as const;

const themeVisualFieldKeys = new Set<string>(themeVisualFields.map(([key]) => key));

export function humanizeField(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bCta\b/g, 'CTA')
    .replace(/\bUrl\b/g, 'URL')
    .replace(/^App /, 'Mobile/App ');
}

export function isLongTextField(key: string) {
  return /subtitle|body|description/i.test(key);
}

export function fieldValue(theme: Partial<HomeThemeSettings> | undefined, id: HomeThemeId, key: keyof HomeThemeSettings, defaults: Record<HomeThemeId, HomeThemeSettings>) {
  if (theme && Object.prototype.hasOwnProperty.call(theme, key)) {
    return String(theme[key] ?? '');
  }
  return String(defaults[id][key] ?? defaultHomeThemes[id][key] ?? '');
}

function previewChrome(id: HomeThemeId, accent: string, bg: string, radiusCard: string, shadow: string) {
  const shared = {
    backgroundColor: bg,
    borderRadius: radiusCard,
    boxShadow: shadow === 'none' ? '0 18px 50px rgba(0,0,0,0.22)' : shadow,
  };

  const variants: Record<HomeThemeId, CSSProperties> = {
    'theme-1': {
      ...shared,
      backgroundImage:
        'linear-gradient(90deg, rgba(13,23,32,0.06) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(232,242,246,0.92))',
      backgroundSize: '34px 34px, 100% 100%',
      borderColor: 'rgba(36,91,115,0.20)',
    },
    'theme-2': {
      ...shared,
      backgroundImage:
        `radial-gradient(circle at 12% 18%, ${accent}55, transparent 28%), linear-gradient(135deg, #121826, #2f1a62 58%, #f9731630)`,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    'theme-3': {
      ...shared,
      backgroundImage:
        'linear-gradient(90deg, rgba(45,106,79,0.08) 1px, transparent 1px), linear-gradient(180deg, #fffaf1, #efe5d4)',
      backgroundSize: '48px 48px, 100% 100%',
      borderColor: 'rgba(45,106,79,0.24)',
    },
    'theme-4': {
      ...shared,
      backgroundImage:
        `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px), linear-gradient(135deg, #05070d, #0c1424)`,
      backgroundSize: '24px 24px, 24px 24px, 100% 100%',
      borderColor: `${accent}55`,
    },
    'theme-5': {
      ...shared,
      backgroundImage:
        'linear-gradient(90deg, rgba(26,26,26,0.04) 1px, transparent 1px), linear-gradient(180deg, #fff7f0, #f0e2d4)',
      backgroundSize: '38px 38px, 100% 100%',
      borderColor: 'rgba(26,26,26,0.22)',
    },
    'theme-6': {
      ...shared,
      backgroundImage:
        `radial-gradient(circle at 18% 10%, ${accent}40, transparent 34%), radial-gradient(circle at 82% 18%, #93c5fd66, transparent 32%), linear-gradient(135deg, #fff7fb, #e7f0ff 58%, #fff5cf)`,
      borderColor: 'rgba(255,255,255,0.72)',
    },
    'theme-7': {
      ...shared,
      backgroundImage:
        `radial-gradient(circle at 78% 18%, ${accent}44, transparent 30%), radial-gradient(circle at 18% 82%, #1d9bf033, transparent 28%), linear-gradient(135deg, #050816, #0b1024 58%, #181038)`,
      backgroundSize: '100% 100%, 100% 100%, 100% 100%',
      borderColor: 'rgba(139,92,246,0.35)',
    },
  };

  return variants[id];
}

export function ThemeSystemCard({ id, active, value, defaults }: { id: HomeThemeId; active: boolean; value?: Partial<HomeThemeSettings>; defaults: Record<HomeThemeId, HomeThemeSettings> }) {
  const definition = getHomeThemeDefinition(id);
  const accent = fieldValue(value, id, 'accentColor', defaults) || definition.preview.accent;
  const bg = fieldValue(value, id, 'backgroundColor', defaults) || definition.preview.bg;
  const fontDisplay = fieldValue(value, id, 'fontDisplay', defaults) || definition.preview.fontDisplay;
  const radiusCard = fieldValue(value, id, 'radiusCard', defaults);
  const shadow = fieldValue(value, id, 'shadow', defaults);

  return (
    <article
      aria-current={active ? 'true' : undefined}
      className={`relative grid gap-4 border-2 p-5 transition ${active ? 'bg-[#06111a]' : 'border-[#2F3336] bg-black hover:bg-[#16181C]'}`}
      style={active ? { borderColor: accent } : undefined}
    >
      {active ? (
        <span
          aria-label="Active theme"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-black"
          style={{ backgroundColor: accent }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-4 rtl:flex-row-reverse">
        <div>
          <p className="text-xs font-black uppercase text-[#71767B]">{definition.family}</p>
          <h3 className="mt-2 text-xl font-black text-white">{fieldValue(value, id, 'name', defaults)}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#71767B]">{definition.adminSummary}</p>
        </div>
        <span className="rounded-full border border-[#2F3336] px-3 py-1 text-xs font-bold text-white">
          {definition.layout}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#2F3336] bg-black px-3 py-1.5 text-xs font-bold text-[#E7E9EA]">
          <span
            aria-label={`Background color ${bg}`}
            className="h-4 w-4 rounded-full border border-[#2F3336]"
            style={{ backgroundColor: bg }}
          />
          <span className="font-mono">{bg}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#2F3336] bg-black px-3 py-1.5 text-xs font-bold text-[#E7E9EA]">
          <span
            aria-label={`Accent color ${accent}`}
            className="h-4 w-4 rounded-full border border-[#2F3336]"
            style={{ backgroundColor: accent }}
          />
          <span className="font-mono">{accent}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#2F3336] bg-black px-3 py-1.5 text-xs font-bold text-[#E7E9EA]">
          <span aria-hidden="true" className="text-base font-black text-[#71767B]">Aa</span>
          <span>{fontDisplay}</span>
        </span>
      </div>

      <div
        className="relative grid min-h-56 overflow-hidden border p-4"
        style={previewChrome(id, accent, bg, radiusCard, shadow)}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-4 top-4 h-px opacity-70"
          style={{ backgroundColor: accent }}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="h-2 w-24 rounded-full" style={{ backgroundColor: accent }} />
          <span className="h-2 w-14 rounded-full bg-[#2F3336]/35" />
        </div>
        <div className={`relative grid gap-3 ${id === 'theme-5' ? 'grid-cols-1' : id === 'theme-2' || id === 'theme-6' || id === 'theme-7' ? 'grid-cols-[0.82fr_1fr]' : 'grid-cols-[1fr_0.82fr]'}`}>
          <div className="grid min-h-32 gap-2 border border-[#2F3336]/30 bg-white/30 p-3 backdrop-blur-sm">
            <span className="h-3 w-3/4 rounded-full bg-[#111827]/70" />
            <span className="h-3 w-full rounded-full bg-[#111827]/35" />
            <span className="h-3 w-5/6 rounded-full bg-[#111827]/35" />
            <span className="h-3 w-2/3 rounded-full bg-[#111827]/25" />
            <span className="mt-auto h-8 w-28 rounded-full" style={{ backgroundColor: accent }} />
          </div>
          <div className="grid min-h-32 gap-2 border border-[#2F3336]/30 bg-black/10 p-3 backdrop-blur-sm">
            {definition.preview.sections.slice(0, 4).map((section, index) => (
              <span
                key={section}
                className="rounded-full"
                style={{
                  backgroundColor: index === 0 ? accent : 'rgba(17,24,39,0.28)',
                  opacity: index === 0 ? 0.95 : 0.72,
                }}
              />
            ))}
          </div>
        </div>
        <p className="relative text-xs font-black text-[#111827]/70" style={{ fontFamily: fontDisplay }}>
          {definition.preview.hero}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {definition.structure.map((section) => (
          <span className="rounded-full border border-[#2F3336] px-3 py-1 text-xs font-bold text-[#E7E9EA]" key={section}>{section}</span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[#2F3336] pt-4">
        {active ? (
          <span
            className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 px-5 text-sm font-black"
            style={{ borderColor: accent, color: accent }}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Active theme
          </span>
        ) : (
          <form action="/api/admin/theme/activate" method="post">
            <CsrfInput />
            <input type="hidden" name="homeTheme" value={id} />
            <button className="btn-primary min-h-10 px-5" type="submit">Activate</button>
          </form>
        )}
        <Link className="btn-secondary min-h-10 px-5" href={`/admin/theme/${id}`}>
          Customize
        </Link>
        <Link className="btn-secondary min-h-10 px-5" href={`/?previewTheme=${id}`} target="_blank">
          Preview
        </Link>
      </div>
    </article>
  );
}

export function ThemeEditorFields({ id, value, defaults }: { id: HomeThemeId; value?: Partial<HomeThemeSettings>; defaults: Record<HomeThemeId, HomeThemeSettings> }) {
  const prefix = `themes.${id}`;
  const extraFields = Object.keys(defaultHomeThemes[id]).filter((key) => !mainCopyFields.has(key) && !themeVisualFieldKeys.has(key));

  return (
    <section className="card grid gap-5">
      <div className="flex flex-wrap justify-end gap-2">
        <Link className="btn-secondary min-h-9 px-4" href={`/?previewTheme=${id}`} target="_blank">
          Preview
        </Link>
        <button
          className="min-h-9 rounded-full border border-[#F4212E] px-4 text-sm font-black text-[#F4212E] transition hover:bg-[#F4212E]/10"
          name="resetTheme"
          type="submit"
          value={id}
          title="Reset this theme to its localized default values"
        >
          Reset to defaults
        </button>
      </div>
      <div className="border border-[#2F3336] bg-[#050505] p-4">
        <p className="text-sm font-black text-white">Editing {fieldValue(value, id, 'name', defaults)}</p>
        <p className="mt-1 text-sm leading-6 text-[#71767B]">Change this theme copy, visuals, hero image, and homepage microcopy without touching the other themes.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold text-[#E7E9EA]">
          Theme display name
          <input className="input mt-2" name={`${prefix}.name`} defaultValue={fieldValue(value, id, 'name', defaults)} />
        </label>
        <label className="text-sm font-bold text-[#E7E9EA]">
          Description
          <input className="input mt-2" name={`${prefix}.description`} defaultValue={fieldValue(value, id, 'description', defaults)} />
        </label>
      </div>
      <label className="text-sm font-bold text-[#E7E9EA]">
        Hero title
        <input className="input mt-2" name={`${prefix}.heroTitle`} defaultValue={fieldValue(value, id, 'heroTitle', defaults)} />
      </label>
      <label className="text-sm font-bold text-[#E7E9EA]">
        Hero subtitle
        <textarea className="input mt-2 min-h-24" name={`${prefix}.heroSubtitle`} defaultValue={fieldValue(value, id, 'heroSubtitle', defaults)} />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        {(['primaryCtaLabel', 'primaryCtaUrl', 'secondaryCtaLabel', 'secondaryCtaUrl', 'featuredTitle', 'featuredSubtitle', 'panelTitle', 'panelSubtitle', 'searchPlaceholder', 'recommendedTitle', 'recommendedSubtitle'] as const).map((key) => (
          <label className={`text-sm font-bold text-[#E7E9EA] ${key === 'recommendedSubtitle' ? 'md:col-span-2' : ''}`} key={key}>
            {humanizeField(key)}
            <input className="input mt-2" name={`${prefix}.${key}`} defaultValue={fieldValue(value, id, key, defaults)} />
          </label>
        ))}
      </div>
      <div className="border-t border-[#2F3336] pt-4">
        <h3 className="text-sm font-black text-white">Theme visual controls</h3>
        <p className="mt-1 text-sm leading-6 text-[#71767B]">These values affect only this homepage theme: accent color, local surfaces, text colors, borders, and hero media.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {themeVisualFields.map(([key, label]) => (
            <label className="text-sm font-bold text-[#E7E9EA]" key={key}>
              {label}
              <input className="input mt-2" name={`${prefix}.${key}`} defaultValue={fieldValue(value, id, key, defaults)} placeholder={fieldValue(undefined, id, key, defaults)} />
            </label>
          ))}
          <label className="text-sm font-bold text-[#E7E9EA] md:col-span-2">
            Upload hero image
            <input className="input mt-2 file:mr-4 file:rounded-full file:border-0 file:bg-[#1D9BF0] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white" name={`${prefix}.heroImageFile`} type="file" accept="image/png,image/jpeg,image/webp" />
            <span className="mt-2 block text-xs font-semibold text-[#71767B]">Upload overrides the pasted hero image URL after saving. Leave both empty to use the course/slider visual fallback.</span>
          </label>
        </div>
      </div>
      <div className="border-t border-[#2F3336] pt-4">
        <h3 className="text-sm font-black text-white">Homepage labels and microcopy</h3>
        <p className="mt-1 text-sm leading-6 text-[#71767B]">These fields cover the smaller homepage labels, counters, cards, proof sections, and conversion text used by this theme.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {extraFields.map((key) => (
            <label className={`text-sm font-bold text-[#E7E9EA] ${isLongTextField(key) ? 'md:col-span-2' : ''}`} key={key}>
              {humanizeField(key)}
              {isLongTextField(key) ? (
                <textarea className="input mt-2 min-h-20" name={`${prefix}.${key}`} defaultValue={fieldValue(value, id, key, defaults)} />
              ) : (
                <input className="input mt-2" name={`${prefix}.${key}`} defaultValue={fieldValue(value, id, key, defaults)} />
              )}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
