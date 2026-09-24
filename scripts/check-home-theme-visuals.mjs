import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const baseUrl = (process.env.BASE_URL || process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const homeThemeRegistry = [
  { id: 'theme-1', layout: 'modern-minimal' },
  { id: 'theme-2', layout: 'bold-vibrant' },
  { id: 'theme-3', layout: 'classic-academic' },
  { id: 'theme-4', layout: 'dark-tech' },
  { id: 'theme-5', layout: 'editorial-magazine' },
  { id: 'theme-6', layout: 'glass-pastel' },
  { id: 'theme-7', layout: 'learnova-default' },
];
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

const viewports = [
  { name: 'desktop', width: 1366, height: 768, minHeroHeight: 240 },
  { name: 'mobile', width: 390, height: 844, minHeroHeight: 220 },
];

function fail(message) {
  throw new Error(message);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
    if (!chromePath) throw error;
    return chromium.launch({ headless: true, executablePath: chromePath });
  }
}

async function waitForDemo() {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 45_000) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
      lastError = new Error(`/api/health returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw lastError || new Error(`Timed out waiting for ${baseUrl}`);
}

function assertThemeRender(theme, viewport, info) {
  if (info.themeId !== theme.id) {
    fail(`${theme.id} ${viewport.name}: expected data-home-theme-id="${theme.id}", got "${info.themeId}"`);
  }

  if (info.layout !== theme.layout) {
    fail(`${theme.id} ${viewport.name}: expected layout "${theme.layout}", got "${info.layout}"`);
  }

  if (!info.title || info.title.length < 12) {
    fail(`${theme.id} ${viewport.name}: missing meaningful hero title`);
  }

  if (!info.primaryCtaVisible) {
    fail(`${theme.id} ${viewport.name}: primary CTA is not visible`);
  }

  if (info.overflowX) {
    fail(`${theme.id} ${viewport.name}: horizontal overflow detected (${info.scrollWidth}px > ${info.innerWidth}px)`);
  }

  if (info.heroHeight < viewport.minHeroHeight) {
    fail(`${theme.id} ${viewport.name}: hero section is unexpectedly short (${info.heroHeight}px)`);
  }

  if (info.h1Top < 0 || info.h1Bottom > viewport.height + 80) {
    fail(`${theme.id} ${viewport.name}: hero title is poorly framed in the first viewport`);
  }
}

async function checkTheme(page, theme, viewport) {
  const url = `${baseUrl}/?previewTheme=${theme.id}`;
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  if (!response?.ok()) fail(`${theme.id} ${viewport.name}: ${url} returned HTTP ${response?.status()}`);

  const info = await page.evaluate(() => {
    const main = document.querySelector('.home-theme');
    const hero = document.querySelector('.home-theme section');
    const h1 = document.querySelector('.home-theme h1');
    const primaryCta =
      document.querySelector('.home-theme a[href="/courses"]') ||
      document.querySelector('.home-theme a[href^="/courses"]') ||
      document.querySelector('.home-theme button[type="submit"]');

    const heroRect = hero?.getBoundingClientRect();
    const h1Rect = h1?.getBoundingClientRect();
    const ctaRect = primaryCta?.getBoundingClientRect();

    return {
      themeId: main?.getAttribute('data-home-theme-id') || '',
      layout: main?.getAttribute('data-home-theme-layout') || '',
      title: h1?.textContent?.trim() || '',
      heroHeight: heroRect ? Math.round(heroRect.height) : 0,
      h1Top: h1Rect ? Math.round(h1Rect.top) : 0,
      h1Bottom: h1Rect ? Math.round(h1Rect.bottom) : 0,
      primaryCtaVisible: Boolean(ctaRect && ctaRect.width > 0 && ctaRect.height > 0),
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  });

  assertThemeRender(theme, viewport, info);
  return {
    theme: theme.id,
    layout: theme.layout,
    viewport: viewport.name,
    heroHeight: info.heroHeight,
    titleLength: info.title.length,
  };
}

async function main() {
  await waitForDemo();

  const browser = await launchBrowser();
  const results = [];

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const theme of homeThemeRegistry) {
        results.push(await checkTheme(page, theme, viewport));
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`Home theme visual QA passed for ${homeThemeRegistry.length} themes at ${baseUrl}`);
  for (const result of results) {
    console.log(`OK ${result.theme} ${result.viewport} ${result.layout} hero=${result.heroHeight}px title=${result.titleLength} chars`);
  }
}

main().catch((error) => {
  console.error(`Home theme visual QA failed: ${error.message}`);
  process.exit(1);
});
