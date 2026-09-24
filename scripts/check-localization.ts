import { readFileSync } from 'node:fs';
import { footerLinksByLocale, languagePresets, localizedCopy, localizedDashboardLabel, localizedHomeThemes, navLinksByLocale } from '../lib/localized-copy';
import { dictionaries, direction } from '../lib/i18n';
import { localizedPageCopy } from '../lib/page-copy';

type Issue = { label: string; detail: string };

const issues: Issue[] = [];
const allowedUntranslatedDashboardLabels = new Set(['API', 'DPA', 'LTI Tools', 'NPS', 'SCORM', 'SEO', 'SLA Policies']);
const mojibakePattern = /[\uFFFD]|Ã|Â|Ø|Ù/;
const asciiTransliterationPattern = /\b(?:Ogren|ogren|Canli|canli|Egit|egit|Giris|Cikis|olustur|Basla|Menuyu|Katalogu|Onizleme|Ucretsiz|Tum|hizinda|sonuc|Baslangic|Ingilizce|Arapca|degil|Onceki|yildiz|yuksek|dusuk|odeme|guvenli|hazirlandi|ogrenci|gorunecek|yayinlayin|sesion|contrasena|oeffnen|bestaetigt|aendern|fuer|Waehlen|geprueft|Anfaenger|Zurueck|Kuerzeste|fuellen)\b/;

function record(label: string, ok: boolean, detail: string) {
  if (!ok) issues.push({ label, detail });
  console.log(`${ok ? 'OK' : 'REVIEW'} ${label}${detail ? ` - ${detail}` : ''}`);
}

function leafPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [`${prefix}:array(${value.length})`];
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .flatMap(([key, nested]) => leafPaths(nested, prefix ? `${prefix}.${key}` : key))
      .sort();
  }
  return [prefix];
}

function missingComparedTo(base: string[], candidate: string[]) {
  const candidateSet = new Set(candidate);
  return base.filter((key) => !candidateSet.has(key));
}

function extractDashboardLabels() {
  const source = readFileSync('components/dashboard/DashboardShell.tsx', 'utf8');
  const labels = [...source.matchAll(/label:'([^']+)'/g)].map((match) => match[1]);
  const sections = [...source.matchAll(/title: '([^']+)'/g)].map((match) => match[1]);
  return [...new Set([...labels, ...sections])].sort();
}

const filesToScan = ['lib/localized-copy.ts', 'lib/page-copy.ts', 'lib/i18n.ts'];
for (const file of filesToScan) {
  const content = readFileSync(file, 'utf8');
  record(`No mojibake in ${file}`, !mojibakePattern.test(content), 'UTF-8 text should not contain replacement or double-encoded markers.');
  record(`No ASCII transliteration in ${file}`, !asciiTransliterationPattern.test(content), 'Localized European/Turkish text should keep native accents.');
}

const copyBase = leafPaths(localizedCopy('en'));
const pageBase = leafPaths(localizedPageCopy('en'));
const homeBase = leafPaths(localizedHomeThemes('en'));
const dictionaryBase = leafPaths(dictionaries.en);
const dashboardLabels = extractDashboardLabels();

for (const language of languagePresets) {
  const code = language.code;
  record(`${code} normalize/copy`, Boolean(localizedCopy(code)), 'localizedCopy returns a dictionary.');
  record(`${code} page copy`, Boolean(localizedPageCopy(code)), 'localizedPageCopy returns a dictionary.');
  record(`${code} nav links`, navLinksByLocale[code]?.length === navLinksByLocale.en.length, `${navLinksByLocale[code]?.length || 0}/${navLinksByLocale.en.length} links`);
  record(`${code} footer links`, footerLinksByLocale[code]?.length === footerLinksByLocale.en.length, `${footerLinksByLocale[code]?.length || 0}/${footerLinksByLocale.en.length} links`);
  record(`${code} home themes`, missingComparedTo(homeBase, leafPaths(localizedHomeThemes(code))).length === 0, 'theme settings include every default key.');
  record(`${code} core copy keys`, missingComparedTo(copyBase, leafPaths(localizedCopy(code))).length === 0, 'localizedCopy has every English key.');
  record(`${code} page copy keys`, missingComparedTo(pageBase, leafPaths(localizedPageCopy(code))).length === 0, 'localizedPageCopy has every English key.');
  record(`${code} i18n keys`, missingComparedTo(dictionaryBase, leafPaths(dictionaries[code])).length === 0, 'i18n dictionary has every English key.');
  record(`${code} direction`, direction(code) === language.direction, `${direction(code)} expected ${language.direction}`);

  if (code !== 'en') {
    const untranslated = dashboardLabels.filter((label) => {
      const translated = localizedDashboardLabel(label, code);
      return translated === label && !allowedUntranslatedDashboardLabels.has(label) && !/^[A-Z0-9/& -]+$/.test(label);
    });
    record(`${code} dashboard labels`, untranslated.length === 0, untranslated.slice(0, 8).join(', '));
  }
}

const arabicSample = JSON.stringify(localizedCopy('ar')) + JSON.stringify(localizedPageCopy('ar')) + JSON.stringify(dictionaries.ar);
record('Arabic copy contains Arabic script', /[\u0600-\u06FF]/.test(arabicSample), 'Arabic dictionaries should contain real Arabic text.');

if (issues.length) {
  console.error(`Localization check found ${issues.length} issue(s).`);
  process.exit(1);
}

console.log('Localization check passed.');
