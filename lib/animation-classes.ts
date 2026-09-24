import type { HomeThemeLayout } from '@/lib/home-theme-registry';

/**
 * Base transition class applied to all interactive elements.
 * Uses GPU-composited properties (transform, opacity) for smooth 60fps animations.
 */
export const TRANSITION_BASE = 'transition-all duration-200 ease-out';

/**
 * Interactive transition with explicit 200ms duration for hover/active states.
 */
export const TRANSITION_INTERACTIVE = 'transition-all duration-[200ms] ease-out';

/**
 * Returns theme-specific hover effect classes for course cards.
 * All hover effects use only GPU-composited properties (transform, opacity)
 * or non-layout-triggering properties (box-shadow, backdrop-filter, background-color, border-color).
 */
export function cardHoverClasses(theme: HomeThemeLayout): string {
  const base = 'transition-all duration-200 ease-out';
  switch (theme) {
    case 'modern-minimal':
      return `${base} hover:-translate-y-1 hover:shadow-lg`;
    case 'bold-vibrant':
      return `${base} hover:scale-[1.03] hover:shadow-xl`;
    case 'dark-tech':
      return `${base} hover:border-[var(--home-accent)]/40 hover:bg-[var(--home-surface-alt)]`;
    case 'editorial-magazine':
      return `${base} hover:bg-[var(--home-surface-alt)]`;
    case 'glass-pastel':
      return `${base} hover:backdrop-blur-xl hover:bg-white/20`;
    case 'classic-academic':
      return `${base} hover:-translate-y-0.5 hover:shadow-md`;
    case 'learnova-default':
      return `${base} hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(124,60,255,0.20)]`;
  }
}

/**
 * Returns hover/active effect classes for CTA buttons.
 * Uses scale transform (GPU-composited) for smooth interaction feedback.
 */
export function ctaHoverClasses(): string {
  return 'transition-all duration-200 ease-out hover:scale-[1.03] active:scale-[0.98]';
}

/**
 * Reduced motion override using Tailwind's motion-reduce variants.
 * Apply alongside animation classes to respect user's prefers-reduced-motion preference.
 * Disables all transform-based animations and transitions when reduced motion is active.
 */
export const REDUCED_MOTION_OVERRIDE = 'motion-reduce:transform-none motion-reduce:transition-none';
