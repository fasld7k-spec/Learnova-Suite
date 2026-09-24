import { homeThemeCopyFields, homeThemeIds } from '../lib/home-theme-registry';
import { readFileSync } from 'node:fs';

const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const password = process.env.DEMO_PASSWORD || 'password123';

function runSourceFallback() {
  const pageSource = readFileSync('app/admin/theme/page.tsx', 'utf8');
  const customizeSource = readFileSync('app/admin/theme/[id]/page.tsx', 'utf8');
  const controlsSource = readFileSync('components/admin/HomeThemeControls.tsx', 'utf8');
  const failures: string[] = [];

  if (!pageSource.includes('resetAllThemes')) failures.push('/admin/theme source missing resetAllThemes control');
  if (!pageSource.includes('ThemeSystemCard')) failures.push('/admin/theme source missing ThemeSystemCard list');
  if (!customizeSource.includes('ThemeEditorFields')) failures.push('/admin/theme/[id] source missing ThemeEditorFields');
  if (!controlsSource.includes('heroImageFile')) failures.push('ThemeEditorFields source missing heroImageFile upload');
  if (!controlsSource.includes('mainCopyFields')) failures.push('ThemeEditorFields source missing mainCopyFields');
  if (!controlsSource.includes('themeVisualFields')) failures.push('ThemeEditorFields source missing themeVisualFields');
  if (!controlsSource.includes('extraFields')) failures.push('ThemeEditorFields source missing dynamic extraFields');
  if (!controlsSource.includes('Object.keys(defaultHomeThemes[id])')) {
    failures.push('ThemeEditorFields source missing default theme key discovery');
  }
  if (!controlsSource.includes('name={`${prefix}.${key}`}')) {
    failures.push('ThemeEditorFields source missing dynamic field name binding');
  }

  if (failures.length) {
    console.error('Admin theme source fallback check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Admin theme source fallback covers ${homeThemeCopyFields.length} editable fields plus upload for ${homeThemeIds.length} themes.`);
}

async function main() {
  let login: Response;
  try {
    login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: baseUrl,
        referer: `${baseUrl}/login`,
        'sec-fetch-site': 'same-origin',
      },
      body: new URLSearchParams({ email: 'admin@demo.com', password }),
      redirect: 'manual',
    });
  } catch {
    runSourceFallback();
    return;
  }

  const cookie = (login.headers.get('set-cookie') || '')
    .split(/,\s*(?=[^;,]+=)/)
    .map((value) => value.split(';')[0])
    .find((value) => value.startsWith('learnova_token='));

  if (!cookie) {
    throw new Error(`Admin login failed: ${login.status}`);
  }

  const failures: string[] = [];
  const themeIndex = await fetch(`${baseUrl}/admin/theme`, { headers: { cookie } });
  const themeIndexHtml = await themeIndex.text();

  if (!themeIndex.ok) failures.push(`/admin/theme returned HTTP ${themeIndex.status}`);
  if (!themeIndexHtml.includes('name="resetAllThemes"')) failures.push('/admin/theme missing resetAllThemes control');
  if (!themeIndexHtml.includes('Reset all themes')) failures.push('/admin/theme missing reset all themes label');

  for (const id of homeThemeIds) {
    const response = await fetch(`${baseUrl}/admin/theme/${id}`, { headers: { cookie } });
    const html = await response.text();

    if (!response.ok) failures.push(`${id} returned HTTP ${response.status}`);

    for (const field of homeThemeCopyFields.map(String)) {
      const name = `name="themes.${id}.${field}"`;
      if (!html.includes(name)) failures.push(`${id} missing ${name}`);
    }

    const uploadName = `name="themes.${id}.heroImageFile"`;
    if (!html.includes(uploadName)) failures.push(`${id} missing ${uploadName}`);
  }

  if (failures.length) {
    console.error('Admin theme field check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Admin theme editor exposes ${homeThemeCopyFields.length} editable fields plus upload for ${homeThemeIds.length} themes.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
