/**
 * lib/theme-style.ts
 *
 * Extracted `themeStyle()` function so it can be imported by both
 * `app/page.tsx` and property-based tests without pulling in Next.js
 * server-only modules.
 */

import type { CSSProperties } from 'react';
import type { HomeThemeSettings, HomeThemeId } from '@/lib/home-theme-registry';
import type { SiteSettings } from '@/lib/site-settings';

export type HomeThemeCssVars = CSSProperties & Record<string, string>;

export function themeStyle(settings: SiteSettings, copy: HomeThemeSettings): HomeThemeCssVars {
  const accent = copy.accentColor || settings.primaryColor;

  return {
    // Brand tokens (global override within .home-theme scope)
    '--brand':                       accent,
    '--brand-strong':                copy.accentStrongColor || settings.brandStrongColor,

    // Background and surface tokens
    '--home-bg':                     copy.backgroundColor || settings.backgroundColor,
    '--home-surface':                copy.surfaceColor || settings.panelStrongColor,
    '--home-surface-alt':            copy.surfaceAltColor || settings.panelColor,

    // Text tokens
    '--home-text':                   copy.textColor || settings.foregroundColor,
    '--home-muted':                  copy.mutedTextColor || settings.mutedColor,

    // Border token
    '--home-border':                 copy.borderColor || settings.borderColor,

    // Accent tokens
    '--home-accent':                 accent,
    '--home-accent-strong':          copy.accentStrongColor || settings.brandStrongColor,
    '--home-accent-soft':            copy.accentSoftColor || settings.brandSoftColor,

    // Button token
    '--home-button-text':            copy.buttonTextColor || settings.buttonTextColor,

    // Typography tokens
    '--home-font-family':            copy.fontFamily || settings.fontFamily,
    '--home-font-display':           copy.fontDisplay || copy.fontFamily || settings.fontFamily,

    // Shape tokens
    '--home-radius':                 copy.radius || settings.radius,
    '--home-radius-card':            copy.radiusCard || copy.radius || settings.radius,

    // Shadow tokens
    '--home-shadow':                 copy.shadow || '0 1px 3px rgba(0,0,0,0.12)',
    '--home-shadow-hover':           copy.shadowHover || '0 4px 12px rgba(0,0,0,0.1)',
    '--home-shadow-glow':            copy.shadowGlow || 'none',

    // Focus token
    '--home-focus-ring':             copy.focusRingColor || accent,

    // Transition token
    '--home-transition-duration':    '200ms',

    // Spacing token
    '--home-section-gap':            copy.sectionGap || '80px',

    // Hero overlay tokens
    '--home-hero-overlay':           copy.heroOverlayColor || 'rgba(0, 0, 0, 0.5)',
    '--home-hero-overlay-opacity':   copy.heroOverlayOpacity || '0.5',
  };
}
