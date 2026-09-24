import type { HomeThemeLayout } from '@/lib/home-theme-registry';

/**
 * Generates theme-specific focus ring classes using outline-based indicators.
 * Uses `outline` (not `border`) to prevent layout shifts when focus appears.
 * Only visible on keyboard navigation via `focus-visible`.
 */
export function focusRingClasses(theme: HomeThemeLayout): string {
  const base = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline';
  const colors: Record<HomeThemeLayout, string> = {
    'modern-minimal': 'focus-visible:outline-[#245B73]',
    'bold-vibrant': 'focus-visible:outline-[#F97316]',
    'classic-academic': 'focus-visible:outline-[#2D6A4F]',
    'dark-tech': 'focus-visible:outline-[#00F5FF]',
    'editorial-magazine': 'focus-visible:outline-[#9F2B2E]',
    'glass-pastel': 'focus-visible:outline-[#DB2777]',
    'learnova-default': 'focus-visible:outline-[#8B5CF6]',
  };
  return `${base} ${colors[theme]}`;
}
