import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { defaultHomeThemes, homeThemeCopyFields, homeThemeIds, parseHomeThemeId, type HomeThemeId, type HomeThemeSettings } from '@/lib/home-theme-registry';
import { localizedHomeThemes } from '@/lib/localized-copy';
import { invalidateSiteSettingsCache } from '@/lib/cache';
import { saveFileToStorage } from '@/lib/storage';
import { verifyCsrf } from '@/lib/csrf';

function text(form: FormData, key: string, fallback = '') {
  const value = String(form.get(key) || '').trim();
  return value || fallback;
}

function themeText(form: FormData, key: string, fallback = '') {
  if (!form.has(key)) return fallback;
  return String(form.get(key) ?? '').trim();
}

const cssValueFields = new Set<keyof HomeThemeSettings>([
  'accentColor',
  'accentStrongColor',
  'accentSoftColor',
  'backgroundColor',
  'surfaceColor',
  'surfaceAltColor',
  'textColor',
  'mutedTextColor',
  'borderColor',
  'buttonTextColor',
  'fontFamily',
  'fontDisplay',
  'radius',
  'radiusCard',
  'shadow',
  'heroOverlayColor',
  'heroOverlayOpacity',
]);

const urlFields = new Set<keyof HomeThemeSettings>([
  'primaryCtaUrl',
  'secondaryCtaUrl',
  'heroImageUrl',
]);

function cleanCssValue(value: string, fallback: string) {
  if (!value) return '';
  if (/[;{}<>`]/.test(value)) return fallback;
  return value;
}

function cleanOpacity(value: string, fallback: string) {
  if (!value) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return String(Math.min(1, Math.max(0, numeric)));
}

function cleanUrlValue(value: string, fallback: string) {
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return value;
  } catch {
    return fallback;
  }
  return fallback;
}

function cleanThemeField(field: keyof HomeThemeSettings, value: string, fallback: string) {
  if (field === 'heroOverlayOpacity') return cleanOpacity(value, fallback);
  if (urlFields.has(field)) return cleanUrlValue(value, fallback);
  if (cssValueFields.has(field)) return cleanCssValue(value, fallback);
  return value;
}

function cleanTheme(theme: Partial<HomeThemeSettings>) {
  return Object.fromEntries(
    Object.entries(theme).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : String(value ?? '')])
  ) as Partial<HomeThemeSettings>;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const currentRow = await prisma.setting.findUnique({ where: { key: 'theme' } });
    const current = fromJsonObject<any>(currentRow?.value);
    const homeTheme = parseHomeThemeId(form.get('homeTheme'), parseHomeThemeId(current.homeTheme));
    const themeId = homeThemeIds.includes(String(form.get('themeId')) as HomeThemeId) ? String(form.get('themeId')) as HomeThemeId : null;
    const resetTheme = homeThemeIds.includes(String(form.get('resetTheme')) as HomeThemeId) ? String(form.get('resetTheme')) as HomeThemeId : null;
    const resetAllThemes = form.get('resetAllThemes') === '1';
    const globalOnly = form.get('globalOnly') === '1';
    const activeLanguage = await prisma.language.findFirst({ where: { active: true }, orderBy: { code: 'asc' } }).catch(() => null);
    const defaults = localizedHomeThemes(activeLanguage?.code || 'en') || defaultHomeThemes;
    const existingRaw = fromJsonObject<Record<HomeThemeId, Partial<HomeThemeSettings>>>(current.homeThemes);
    const existingThemes = homeThemeIds.reduce((themes, id) => {
      themes[id] = {
        ...defaultHomeThemes[id],
        ...defaults[id],
        ...cleanTheme(existingRaw[id] || {})
      } as HomeThemeSettings;
      return themes;
    }, {} as Record<HomeThemeId, HomeThemeSettings>);

    let homeThemes = existingThemes;
    if (resetAllThemes) {
      homeThemeIds.forEach((id) => {
        homeThemes[id] = defaults[id];
      });
    } else if (resetTheme) {
      homeThemes[resetTheme] = defaults[resetTheme];
    } else if (themeId && !globalOnly) {
      homeThemes[themeId] = homeThemeCopyFields.reduce((theme, field) => {
        const fallback = String(existingThemes[themeId]?.[field] ?? defaults[themeId]?.[field] ?? defaultHomeThemes[themeId]?.[field] ?? '');
        const value = themeText(form, `themes.${themeId}.${field}`, fallback);
        theme[field] = cleanThemeField(field, value, fallback) as never;
        return theme;
      }, {} as HomeThemeSettings);
    } else if (!globalOnly) {
      homeThemes = homeThemeIds.reduce((themes, id) => {
        themes[id] = homeThemeCopyFields.reduce((theme, field) => {
          const fallback = String(existingThemes[id]?.[field] ?? defaults[id]?.[field] ?? defaultHomeThemes[id]?.[field] ?? '');
          const value = themeText(form, `themes.${id}.${field}`, fallback);
          theme[field] = cleanThemeField(field, value, fallback) as never;
          return theme;
        }, {} as HomeThemeSettings);
        return themes;
      }, {} as Record<HomeThemeId, HomeThemeSettings>);
    }

    if (!resetAllThemes) {
      const uploadTargets = themeId ? [themeId] : homeThemeIds;
      for (const id of uploadTargets) {
        if (resetTheme === id) continue;
        const uploaded = await saveFileToStorage(form.get(`themes.${id}.heroImageFile`) as File | null, {
          directory: `themes/${id}`,
          allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
          maxBytes: 8 * 1024 * 1024,
          purpose: 'Homepage hero image'
        });
        if (uploaded?.url) {
          homeThemes[id].heroImageUrl = uploaded.url;
        }
      }
    }

    const value = toJson({
      homeTheme,
      primary: text(form, 'primary', current.primary || '#1D9BF0'),
      secondary: text(form, 'secondary', current.secondary || '#16181C'),
      background: text(form, 'background', current.background || '#000000'),
      foreground: text(form, 'foreground', current.foreground || '#FFFFFF'),
      muted: text(form, 'muted', current.muted || '#71767B'),
      border: text(form, 'border', current.border || '#2F3336'),
      panel: text(form, 'panel', current.panel || '#000000'),
      panelStrong: text(form, 'panelStrong', current.panelStrong || '#16181C'),
      brandStrong: text(form, 'brandStrong', current.brandStrong || '#1A8CD8'),
      brandSoft: text(form, 'brandSoft', current.brandSoft || 'rgba(29, 155, 240, 0.14)'),
      buttonText: text(form, 'buttonText', current.buttonText || '#FFFFFF'),
      radius: text(form, 'radius', current.radius || '9999px'),
      font: text(form, 'font', current.font || 'Chirp, Inter, system-ui'),
      homeThemes
    });

    await prisma.setting.upsert({ where: { key: 'theme' }, update: { value }, create: { key: 'theme', value } });
    await invalidateSiteSettingsCache();
    await audit({
      actorId: admin.id,
      action: 'theme.update',
      entity: 'setting',
      entityId: themeId || resetTheme || 'theme',
      metadata: {
        homeTheme,
        themeId,
        resetTheme,
        resetAllThemes,
        globalOnly,
      },
    });
    return NextResponse.redirect(new URL(themeId ? `/admin/theme/${themeId}?saved=1` : '/admin/theme?saved=1', req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
