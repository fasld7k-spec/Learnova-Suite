import fs from 'node:fs';
import path from 'node:path';
import { homeThemeCopyFields, homeThemeIds, homeThemeRegistry, type HomeThemeSettings } from '../lib/home-theme-registry';
import { languagePresets, localizedHomeThemes } from '../lib/localized-copy';

const root = process.cwd();
const failures: string[] = [];

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message: string) {
  failures.push(message);
}

function sortedKeys(value: Record<string, unknown>) {
  return Object.keys(value).sort();
}

function missingComparedTo(expected: string[], actual: string[]) {
  const actualSet = new Set(actual);
  return expected.filter((key) => !actualSet.has(key));
}

const ids = homeThemeRegistry.map((theme) => theme.id);
const idSet = new Set(ids);
if (idSet.size !== ids.length) fail('Home theme IDs must be unique.');
if (ids.length < 6) fail(`Expected at least 6 bundled homepage themes, found ${ids.length}.`);

for (const id of ids) {
  if (!/^theme-\d+$/.test(id)) fail(`Theme ID "${id}" must follow the theme-number pattern.`);
}

const defaultKeys = [...homeThemeCopyFields].map(String).sort();
const controls = read('components/admin/HomeThemeControls.tsx');
const saveRoute = read('app/api/admin/theme/route.ts');
if (!saveRoute.includes('homeThemeCopyFields.reduce')) fail('Admin theme save route must save every registered homeThemeCopyFields key.');
if (!controls.includes('Object.keys(defaultHomeThemes[id])')) fail('Admin theme editor must derive microcopy fields from registered theme defaults.');
for (const key of defaultKeys) {
  const coveredByMainCopy = controls.includes(`'${key}'`);
  const coveredByDynamicMicrocopy = controls.includes('Object.keys(defaultHomeThemes[id])');
  if (!coveredByMainCopy && !coveredByDynamicMicrocopy) {
    fail(`Admin theme editor does not expose registered theme field "${key}".`);
  }
}
for (const theme of homeThemeRegistry) {
  const themeKeys = sortedKeys(theme.defaults);
  const missing = missingComparedTo(defaultKeys, themeKeys);
  if (missing.length) fail(`${theme.id} is missing default fields: ${missing.join(', ')}`);
  const extra = missingComparedTo(themeKeys, defaultKeys);
  if (extra.length) fail(`${theme.id} has fields not covered by homeThemeCopyFields: ${extra.join(', ')}`);
  if (!theme.family.trim()) fail(`${theme.id} is missing admin family text.`);
  if (!theme.adminSummary.trim()) fail(`${theme.id} is missing admin summary text.`);
  if (!theme.structure.length) fail(`${theme.id} needs at least one structure item.`);
  if (!theme.preview.hero || !theme.preview.sections.length || !theme.preview.accent) fail(`${theme.id} has an incomplete admin preview.`);
}

for (const { code } of languagePresets) {
  const localized = localizedHomeThemes(code);
  for (const id of homeThemeIds) {
    const theme = localized[id] as HomeThemeSettings | undefined;
    if (!theme) {
      fail(`${code} locale does not expose ${id}.`);
      continue;
    }
    const missing = missingComparedTo(defaultKeys, sortedKeys(theme));
    if (missing.length) fail(`${code}/${id} is missing localized theme fields: ${missing.join(', ')}`);
  }
}

const appPage = read('app/page.tsx');
if (!appPage.includes('data-home-theme-id')) fail('app/page.tsx should expose data-home-theme-id for stable theme smoke tests.');
if (!appPage.includes('data-home-theme-layout')) fail('app/page.tsx should expose data-home-theme-layout for stable theme smoke tests.');
for (const layout of new Set(homeThemeRegistry.map((theme) => theme.layout))) {
  if (!appPage.includes(`'${layout}'`)) fail(`app/page.tsx does not map renderer for layout "${layout}".`);
}

const smoke = read('scripts/smoke-demo.mjs');
const visualCheck = read('scripts/check-home-theme-visuals.mjs');
const finalGate = read('scripts/final-submission-check.ps1');
const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
for (const id of ids) {
  if (!smoke.includes(`previewTheme=${id}`)) fail(`Smoke test does not preview ${id}.`);
  if (!smoke.includes(`data-home-theme-id="${id}"`)) fail(`Smoke test does not assert data-home-theme-id for ${id}.`);
  if (!visualCheck.includes(`id: '${id}'`)) fail(`Visual theme QA does not cover ${id}.`);
}
for (const id of ids) {
  if (!smoke.includes(`/admin/theme/${id}`)) fail(`Smoke test does not visit /admin/theme/${id}.`);
}
for (const theme of homeThemeRegistry) {
  if (!visualCheck.includes(`layout: '${theme.layout}'`)) fail(`Visual theme QA does not assert layout "${theme.layout}".`);
}

if (packageJson.scripts?.['themes:visual-check'] !== 'node scripts/check-home-theme-visuals.mjs') {
  fail('package.json must expose themes:visual-check for browser-based homepage QA.');
}

if (!finalGate.includes('Homepage visual QA') || !finalGate.includes('npm run themes:visual-check')) {
  fail('Final submission gate must run Homepage visual QA after production build.');
}

const docs = read('docs/home-theme-system.md');
for (const id of ids) {
  if (!docs.includes(`\`${id}\``)) fail(`docs/home-theme-system.md does not mention ${id}.`);
}
if (!docs.includes('themes:visual-check')) fail('docs/home-theme-system.md should document the visual theme QA command.');

if (failures.length) {
  console.error('Home theme check failed:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Home theme check passed for ${ids.length} themes: ${ids.join(', ')}`);
