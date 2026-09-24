import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  Download,
  Headphones,
  LineChart,
  Quote,
  ShieldCheck,
  Smartphone,
  Terminal,
  UsersRound,
} from 'lucide-react';
import { localizedCopy } from '@/lib/localized-copy';
import { formatMoney, type SiteSettings } from '@/lib/site-settings';
import type { HomeThemeId } from '@/lib/home-theme-registry';
import { focusRingClasses } from '@/lib/focus-ring';
import { cardHoverClasses, ctaHoverClasses, REDUCED_MOTION_OVERRIDE } from '@/lib/animation-classes';

// ---------------------------------------------------------------------------
// Types (re-exported so page.tsx can import HomeThemeRenderProps from here)
// ---------------------------------------------------------------------------

type CourseWithRelations = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImage: string | null;
  price: number;
  salePrice: number | null;
  isFree: boolean;
  category: { nameEn: string; nameAr?: string | null; slug: string } | null;
  instructor: { name: string } | null;
  enrollments: { id: string }[];
  reviews: { id: string; rating: number; comment: string | null }[];
};

type SliderLike =
  | { title?: string; subtitle?: string; buttonText?: string; buttonUrl?: string; image?: string }
  | undefined;

export type HomeThemeRenderProps = {
  themeId: HomeThemeId;
  courses: CourseWithRelations[];
  categories: { id: string; nameEn: string; nameAr?: string | null; slug: string; _count?: { courses: number } }[];
  instructors: { id: string; name: string; bio: string | null }[];
  reviews: { id: string; rating: number; comment: string | null; user: { name: string } | null; course: { title: string } }[];
  slide: SliderLike;
  settings: SiteSettings;
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function catLabel(
  category: { nameEn: string; nameAr?: string | null },
  isRtl: boolean,
): string {
  return isRtl ? category.nameAr || category.nameEn : category.nameEn;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * DarkTechTheme — Theme 4
 *
 * Layout:
 *  1. Dashboard-style SPLIT hero: headline left, live-metrics console right
 *  2. Command-center course pipeline table
 *  3. Monospace stats/counter section
 *  4. Instructors + reviews section
 *  5. Business / app section
 *  6. Conversion band
 *
 * Requirements: 5.5, 5.6, 5.7, 5.8, 6.4, 11.1–11.4, 12.1–12.4
 */
export function DarkTechTheme({
  themeId,
  courses,
  categories,
  instructors,
  reviews,
  slide,
  settings,
}: HomeThemeRenderProps) {
  const copy = settings.homeThemes[themeId];
  const ui = localizedCopy(settings.defaultLanguage);
  const isRtl = settings.rtl;

  const heroImage = copy.heroImageUrl || slide?.image;
  const stripCourses = courses.slice(0, 8);
  const reviewCards = reviews.length
    ? reviews.slice(0, 3)
    : courses
        .flatMap((c) =>
          c.reviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            user: null,
            course: { title: c.title },
          })),
        )
        .slice(0, 3);

  const taskLabels = [copy.taskOneLabel, copy.taskTwoLabel, copy.taskThreeLabel].filter(Boolean);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* 1. DASHBOARD-STYLE SPLIT HERO                                        */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative overflow-hidden border-b border-[var(--home-border)] bg-[var(--home-bg)]"
        aria-labelledby="dark-tech-hero-heading"
        style={{
          /* Decorative grid-line background */
          backgroundImage:
            'linear-gradient(var(--home-border) 1px, transparent 1px), linear-gradient(90deg, var(--home-border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          fontFamily: 'var(--home-font-display)',
        }}
      >
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={copy.heroImageAlt || ''}
            aria-hidden={!copy.heroImageAlt ? 'true' : undefined}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {heroImage && (
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{
              background: 'var(--home-hero-overlay)',
              opacity: 'var(--home-hero-overlay-opacity)' as string,
            }}
          />
        )}

        {/*
          Dashboard split: headline + CTAs leading, metrics console trailing.
          Below md → single column stacked.
          Uses CSS logical properties for RTL support.
        */}
        <div
          className="page-shell relative grid items-center gap-10 py-16 md:grid-cols-[1fr_420px] md:py-20"
          style={{ maxInlineSize: '1280px', marginInline: 'auto', lineHeight: '1.45' }}
          dir={isRtl ? 'rtl' : undefined}
        >
          {/* Leading column — headline + CTAs */}
          <div style={{ textAlign: 'start' }}>
            {/* Terminal-style eyebrow */}
            <p
              className="inline-flex items-center gap-2 border border-[var(--home-accent)] text-xs font-bold uppercase tracking-widest text-[var(--home-accent)]"
              style={{
                paddingInline: '0.75rem',
                paddingBlock: '0.25rem',
                boxShadow: '0 0 6px var(--home-accent)',
              }}
            >
              <Terminal size={12} aria-hidden="true" />
              {copy.panelTitle}
            </p>

            <h1
              id="dark-tech-hero-heading"
              className="mt-5 max-w-2xl font-bold text-[var(--home-text)]"
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 3.25rem)',
                lineHeight: '1.4',
                textShadow: '0 0 12px rgba(0, 245, 255, 0.15)',
              }}
            >
              {copy.heroTitle || slide?.title}
            </h1>
            <p
              className="mt-5 max-w-xl text-[var(--home-muted)]"
              style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.125rem)', lineHeight: '1.5' }}
            >
              {copy.heroSubtitle || slide?.subtitle}
            </p>

            {/* CTA buttons — 44px min touch target */}
            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
              style={{ rowGap: '0.75rem', columnGap: '0.75rem' }}
            >
              <Link
                className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-none bg-[var(--home-accent)] text-sm font-bold text-[var(--home-button-text)] ${ctaHoverClasses()} ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
                href={copy.primaryCtaUrl || slide?.buttonUrl || '/courses'}
                style={{
                  paddingInline: '1.5rem',
                  boxShadow: '0 0 16px rgba(0, 245, 255, 0.3)',
                }}
              >
                {copy.primaryCtaLabel || slide?.buttonText || copy.browseCatalogLabel || ui.common.browseCatalog}
                <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden="true" />
              </Link>
              {settings.registrationEnabled && settings.instructorsEnabled && (
                <Link
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-none border border-[var(--home-accent)] bg-transparent text-sm font-bold text-[var(--home-accent)] transition-colors duration-200 ease-out hover:bg-[var(--home-accent-soft)] ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
                  href={copy.secondaryCtaUrl || '/register'}
                  style={{ paddingInline: '1.5rem' }}
                >
                  {copy.secondaryCtaLabel || ui.dashboard.roleLabels.instructor}
                </Link>
              )}
            </div>

            {/* Feature badges */}
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { label: copy.protectedFeatureLabel, icon: ShieldCheck },
                { label: copy.progressFeatureLabel, icon: LineChart },
                { label: copy.certificateFeatureLabel, icon: Award },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="border border-[var(--home-border)] bg-[var(--home-surface)]"
                  style={{ padding: '1rem', boxShadow: '0 0 4px rgba(0, 245, 255, 0.08)' }}
                >
                  <Icon className="text-[var(--home-accent)]" size={18} strokeWidth={1.7} aria-hidden="true" />
                  <p
                    className="mt-3 text-xs font-bold text-[var(--home-text)]"
                    style={{ lineHeight: '1.4' }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Trailing column — live metrics console panel */}
          <aside
            className="border border-[var(--home-accent)] bg-[var(--home-surface)]"
            aria-label="Platform metrics"
            style={{
              padding: '1.25rem',
              boxShadow: '0 0 24px rgba(0, 245, 255, 0.12)',
            }}
          >
            {/* Console header */}
            <div
              className="flex items-center justify-between gap-4 border-b border-[var(--home-border)]"
              style={{ paddingBlockEnd: '1rem' }}
            >
              <div style={{ textAlign: 'start' }}>
                <p
                  className="text-sm font-bold text-[var(--home-text)]"
                  style={{ lineHeight: '1.4' }}
                >
                  {copy.panelTitle}
                </p>
                <p className="mt-1 text-xs text-[var(--home-muted)]" style={{ lineHeight: '1.5' }}>
                  {copy.panelSubtitle}
                </p>
              </div>
              <span
                className="rounded-none border border-[var(--home-accent)] text-xs font-bold text-[var(--home-accent)]"
                style={{
                  paddingInline: '0.75rem',
                  paddingBlock: '0.25rem',
                  boxShadow: '0 0 8px rgba(0, 245, 255, 0.25)',
                }}
              >
                {copy.liveBadgeLabel || ui.common.live}
              </span>
            </div>

            {/* Stat tiles */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: copy.statRevenueLabel || ui.home.stats[0], value: formatMoney(42800, settings.currency), icon: LineChart },
                { label: copy.statLearnersLabel || ui.home.stats[1], value: '18,420', icon: UsersRound },
                { label: copy.statUptimeLabel || ui.home.stats[2], value: '99.9%', icon: ShieldCheck },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="border border-[var(--home-border)] bg-[var(--home-bg)]"
                  style={{ padding: '0.75rem' }}
                >
                  <Icon size={16} strokeWidth={1.8} className="text-[var(--home-accent)]" aria-hidden="true" />
                  <p
                    className="mt-3 text-xl font-bold text-[var(--home-text)] sm:text-2xl"
                    style={{ lineHeight: '1.4', textShadow: '0 0 10px rgba(0, 245, 255, 0.2)' }}
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-[var(--home-muted)]" style={{ lineHeight: '1.5' }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div
              className="mt-4 border border-[var(--home-border)] bg-[var(--home-bg)]"
              style={{ padding: '1rem' }}
            >
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-[var(--home-text)]" style={{ lineHeight: '1.4' }}>
                  {copy.progressLabel || ui.home.completion}
                </span>
                <span className="text-[var(--home-accent)]" style={{ lineHeight: '1.4' }}>
                  74%
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-none bg-[var(--home-surface-alt)]">
                <div
                  className="h-full rounded-none bg-[var(--home-accent)]"
                  style={{ width: '74%', boxShadow: '0 0 8px var(--home-accent)' }}
                  role="progressbar"
                  aria-valuenow={74}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>

            {/* Task list */}
            {taskLabels.length > 0 && (
              <div className="mt-4 border border-[var(--home-border)] bg-[var(--home-bg)]">
                {taskLabels.map((item, idx) => (
                  <div
                    key={item}
                    className={`flex items-center justify-between gap-3 text-sm ${idx > 0 ? 'border-t border-[var(--home-border)]' : ''}`}
                    style={{ paddingInline: '1rem', paddingBlock: '0.75rem', lineHeight: '1.4' }}
                  >
                    <span className="text-[var(--home-muted)]">
                      {item}
                    </span>
                    <ArrowRight
                      size={13}
                      strokeWidth={1.8}
                      className="shrink-0 text-[var(--home-accent)] rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. COMMAND-CENTER COURSE PIPELINE                                   */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="border-b border-[var(--home-border)] bg-[var(--home-bg)]"
        aria-labelledby="dark-tech-courses-heading"
        style={{
          paddingBlock: '72px',
          backgroundImage:
            'linear-gradient(var(--home-border) 1px, transparent 1px), linear-gradient(90deg, var(--home-border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="page-shell" style={{ maxInlineSize: '1280px', marginInline: 'auto' }}>
          <div
            className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            data-animate
          >
            <div className="text-start">
              <h2
                id="dark-tech-courses-heading"
                className="text-2xl font-bold text-[var(--home-text)] sm:text-3xl"
                style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
              >
                {copy.featuredTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-[var(--home-muted)]" style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.5' }}>
                {copy.featuredSubtitle}
              </p>
            </div>
            <Link
              className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 border border-[var(--home-border)] bg-[var(--home-surface)] px-5 py-2.5 text-sm font-bold text-[var(--home-text)] transition-all duration-200 ease-out hover:border-[var(--home-accent)] hover:text-[var(--home-accent)] hover:shadow-[0_0_8px_var(--home-accent)] ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
              href="/courses"
              style={{ borderRadius: '2px', fontFamily: 'var(--home-font-display)' }}
            >
              {copy.browseAllLabel || ui.common.browseCatalog}
              <ArrowRight size={14} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* Course cards grid */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stripCourses.length ? (
              stripCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  data-animate
                  className={`group flex flex-col border border-[var(--home-border)] bg-[var(--home-surface)] ${cardHoverClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('dark-tech')}`}
                  style={{
                    borderRadius: '2px',
                    boxShadow: '0 0 4px rgba(0, 245, 255, 0.06)',
                  }}
                >
                  {/* Thumbnail */}
                  {course.coverImage ? (
                    <div className="relative aspect-video w-full overflow-hidden" style={{ borderRadius: '2px 2px 0 0' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={course.coverImage}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-cover"
                      />
                      {/* Category badge overlay */}
                      {course.category && (
                        <span
                          className="absolute bottom-2 inset-inline-start-2 border border-[var(--home-accent)] bg-[var(--home-bg)]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--home-accent)]"
                          style={{ fontFamily: 'var(--home-font-display)', borderRadius: '2px' }}
                        >
                          {catLabel(course.category, isRtl)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex aspect-video w-full items-center justify-center border-b border-[var(--home-border)] bg-[var(--home-bg)]"
                      style={{ borderRadius: '2px 2px 0 0' }}
                    >
                      <Terminal size={24} className="text-[var(--home-accent)]" aria-hidden="true" />
                    </div>
                  )}

                  {/* Card body */}
                  <div className="flex flex-1 flex-col p-4" style={{ fontFamily: 'var(--home-font-display)' }}>
                    <h3
                      className="line-clamp-2 text-sm font-bold text-[var(--home-text)]"
                      style={{ lineHeight: '1.4' }}
                    >
                      {course.title}
                    </h3>
                    {/* Monospace metadata */}
                    <p
                      className="mt-2 truncate text-xs text-[var(--home-muted)]"
                      style={{ lineHeight: '1.5' }}
                    >
                      {course.instructor?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                    </p>
                    {/* Price + enrollments */}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--home-border)] pt-3" style={{ marginBlockStart: '0.75rem' }}>
                      <span className="text-sm font-bold text-[var(--home-accent)]" style={{ lineHeight: '1.4' }}>
                        {course.isFree
                          ? copy.freeLabel || ui.courseCard.free
                          : formatMoney(course.salePrice ?? course.price, settings.currency)}
                      </span>
                      <span className="text-xs tabular-nums text-[var(--home-muted)]">
                        {course.enrollments?.length ?? 0}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="col-span-full text-sm text-[var(--home-muted)]" style={{ fontFamily: 'var(--home-font-display)' }}>
                {copy.emptyStateLabel}
              </p>
            )}
          </div>

          {/* Pipeline table (desktop view) */}
          <div className="mt-8 hidden overflow-hidden border border-[var(--home-border)] bg-[var(--home-surface)] lg:block" style={{ borderRadius: '2px' }} data-animate>
            {stripCourses.length ? (
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[72px_1.4fr_0.9fr_0.7fr_0.7fr] border-b border-[var(--home-border)] bg-[var(--home-bg)] px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-[var(--home-muted)]" style={{ fontFamily: 'var(--home-font-display)' }}>
                  <span>Node</span>
                  <span>Program</span>
                  <span>Signal</span>
                  <span>Learners</span>
                  <span className="text-end">Access</span>
                </div>
                {stripCourses.map((course, index) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.slug}`}
                    className={`grid grid-cols-[72px_1.4fr_0.9fr_0.7fr_0.7fr] items-center border-b border-[var(--home-border)] px-5 py-4 text-sm text-[var(--home-text)] transition-all duration-200 ease-out last:border-b-0 hover:bg-[var(--home-surface-alt)] hover:shadow-[inset_0_0_12px_rgba(0,245,255,0.05)] ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
                    style={{ fontFamily: 'var(--home-font-display)' }}
                  >
                    <span className="text-[var(--home-accent)]">#{(index + 1).toString().padStart(2, '0')}</span>
                    <span className="min-w-0">
                      <b className="block truncate font-bold">{course.title}</b>
                      <span className="mt-1 block truncate text-xs text-[var(--home-muted)]">
                        {course.instructor?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                      </span>
                    </span>
                    <span className="truncate text-xs uppercase tracking-wide text-[var(--home-accent)]">
                      {course.category ? catLabel(course.category, isRtl) : copy.courseSingularLabel || ui.common.course}
                    </span>
                    <span className="tabular-nums text-[var(--home-muted)]">{course.enrollments?.length ?? 0}</span>
                    <span className="font-bold text-end text-[var(--home-accent)]">
                      {course.isFree
                        ? copy.freeLabel || ui.courseCard.free
                        : formatMoney(course.salePrice ?? course.price, settings.currency)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="p-5 text-sm text-[var(--home-muted)]" style={{ fontFamily: 'var(--home-font-display)' }}>
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. MONOSPACE STATS / COUNTER SECTION                                */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="border-b border-[var(--home-border)] bg-[var(--home-surface)]"
        aria-labelledby="dark-tech-stats-heading"
        style={{
          paddingBlock: '72px',
          backgroundImage:
            'linear-gradient(var(--home-border) 1px, transparent 1px), linear-gradient(90deg, var(--home-border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="page-shell" style={{ maxInlineSize: '1280px', marginInline: 'auto' }}>
          <div
            className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            data-animate
          >
            <h2
              id="dark-tech-stats-heading"
              className="text-2xl font-bold text-[var(--home-text)] sm:text-3xl"
              style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
            >
              {copy.recommendedTitle}
            </h2>
            <p className="max-w-xl text-[var(--home-muted)]" style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.5' }}>
              {copy.recommendedSubtitle}
            </p>
          </div>

          {/* Counter grid — monospace numbers */}
          <div className="mt-10 grid gap-px border border-[var(--home-border)] bg-[var(--home-border)] sm:grid-cols-3" style={{ borderRadius: '2px' }} data-animate>
            {[
              {
                label: copy.counterCoursesLabel || ui.home.counters[0],
                value: courses.length,
                suffix: '+',
              },
              {
                label: copy.counterCategoriesLabel || ui.home.counters[1],
                value: categories.length,
                suffix: '',
              },
              {
                label: copy.counterInstructorsLabel || ui.home.counters[2],
                value: instructors.length,
                suffix: '+',
              },
            ].map(({ label, value, suffix }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center bg-[var(--home-surface)] px-6 py-10 text-center"
              >
                <span
                  className="text-5xl font-bold tabular-nums text-[var(--home-accent)] sm:text-6xl"
                  style={{
                    fontFamily: 'var(--home-font-display)',
                    textShadow: '0 0 20px var(--home-accent)',
                    lineHeight: '1.4',
                  }}
                >
                  {value}
                  {suffix}
                </span>
                <span
                  className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--home-muted)]"
                  style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.5' }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Category links */}
          {categories.length > 0 && (
            <div
              className={`mt-8 flex flex-wrap gap-2 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
              data-animate
            >
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className={`inline-flex h-9 min-h-[44px] min-w-[44px] items-center gap-1.5 border border-[var(--home-border)] bg-[var(--home-bg)] px-4 text-xs font-bold uppercase tracking-widest text-[var(--home-muted)] transition-all duration-200 ease-out hover:border-[var(--home-accent)] hover:text-[var(--home-accent)] hover:shadow-[0_0_6px_rgba(0,245,255,0.2)] ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
                  style={{ fontFamily: 'var(--home-font-display)', borderRadius: '2px' }}
                >
                  {catLabel(category, isRtl)}
                  {category._count?.courses !== undefined && (
                    <span className="text-[var(--home-accent)]">
                      [{category._count.courses}]
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. INSTRUCTORS + REVIEWS                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="border-b border-[var(--home-border)] bg-[var(--home-bg)]"
        aria-labelledby="dark-tech-instructors-heading"
        style={{
          paddingBlock: '72px',
          backgroundImage:
            'linear-gradient(var(--home-border) 1px, transparent 1px), linear-gradient(90deg, var(--home-border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="page-shell grid gap-10 lg:grid-cols-[1fr_0.9fr]" style={{ maxInlineSize: '1280px', marginInline: 'auto' }}>
          {/* Instructors */}
          <div className="text-start" data-animate>
            <h2
              id="dark-tech-instructors-heading"
              className="text-2xl font-bold text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
            >
              {copy.instructorNetworkTitle || copy.storiesTitle}
            </h2>
            <p className="mt-2 text-[var(--home-muted)]" style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.5' }}>
              {copy.storiesBody}
            </p>
            <div className="mt-6 grid gap-0">
              {instructors.length ? (
                instructors.map((instructor) => (
                  <Link
                    key={instructor.id}
                    href={`/instructors/${instructor.id}`}
                    className={`flex items-center gap-4 border-b border-[var(--home-border)] py-4 transition-all duration-200 ease-out hover:text-[var(--home-accent)] hover:shadow-[inset_0_0_8px_rgba(0,245,255,0.04)] ${isRtl ? 'rtl:flex-row-reverse' : ''} ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
                  >
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center border border-[var(--home-border)] bg-[var(--home-surface)] text-sm font-bold text-[var(--home-accent)]"
                      style={{ fontFamily: 'var(--home-font-display)', borderRadius: '2px' }}
                      aria-hidden="true"
                    >
                      {instructor.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[var(--home-text)]" style={{ lineHeight: '1.4' }}>{instructor.name}</b>
                      <span className="mt-0.5 line-clamp-1 text-sm text-[var(--home-muted)]" style={{ lineHeight: '1.5' }}>
                        {instructor.bio || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-[var(--home-muted)]" style={{ fontFamily: 'var(--home-font-display)' }}>
                  {copy.emptyInstructorLabel || ui.home.emptyInstructor}
                </p>
              )}
            </div>
          </div>

          {/* Reviews */}
          <div className="grid gap-4" data-animate>
            {reviewCards.length ? (
              reviewCards.map((review) => (
                <article
                  key={review.id}
                  className="border border-[var(--home-border)] bg-[var(--home-surface)] p-5"
                  style={{ borderRadius: '2px', boxShadow: '0 0 4px rgba(0, 245, 255, 0.06)' }}
                >
                  <Quote className="text-[var(--home-accent)]" size={20} strokeWidth={1.7} aria-hidden="true" />
                  <p className="mt-3 text-base font-medium text-[var(--home-text)]" style={{ lineHeight: '1.5', fontFamily: 'var(--home-font-display)' }}>
                    {review.comment || copy.storiesBody}
                  </p>
                  <div
                    className={`mt-4 flex items-center justify-between gap-4 border-t border-[var(--home-border)] pt-4 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                  >
                    <span
                      className="text-sm font-semibold text-[var(--home-muted)]"
                      style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
                    >
                      {review.user?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-sm font-bold text-[var(--home-accent)]"
                      style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
                    >
                      <Award size={13} aria-hidden="true" />
                      {review.rating}/5
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <article className="border border-[var(--home-border)] bg-[var(--home-surface)] p-5 text-[var(--home-muted)]" style={{ borderRadius: '2px', fontFamily: 'var(--home-font-display)' }}>
                {copy.storiesBody}
              </article>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. BUSINESS + APP SECTION                                           */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="border-b border-[var(--home-border)] bg-[var(--home-surface)]"
        aria-labelledby="dark-tech-business-heading"
        style={{
          paddingBlock: '72px',
          backgroundImage:
            'linear-gradient(var(--home-border) 1px, transparent 1px), linear-gradient(90deg, var(--home-border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="page-shell grid gap-6 lg:grid-cols-2" style={{ maxInlineSize: '1280px', marginInline: 'auto' }}>
          {/* Business panel */}
          <div className="border border-[var(--home-border)] bg-[var(--home-bg)] p-7" style={{ borderRadius: '2px', boxShadow: '0 0 4px rgba(0, 245, 255, 0.06)' }} data-animate>
            <Building2 className="text-[var(--home-accent)]" size={26} strokeWidth={1.7} aria-hidden="true" />
            <h2
              id="dark-tech-business-heading"
              className="mt-5 text-2xl font-bold leading-tight text-start text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
            >
              {copy.businessTitle}
            </h2>
            <p className="mt-3 text-[15px] text-[var(--home-muted)]" style={{ lineHeight: '1.5', fontFamily: 'var(--home-font-display)' }}>
              {copy.businessBody}
            </p>
            <Link
              className={`mt-6 inline-flex min-h-[44px] min-w-[44px] items-center gap-2 bg-[var(--home-accent)] px-6 py-2.5 text-sm font-bold text-[var(--home-button-text)] transition-all duration-200 ease-out hover:bg-[var(--home-accent-strong)] hover:shadow-[0_0_16px_rgba(0,245,255,0.3)] ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
              href="/partners"
              style={{ borderRadius: '2px', fontFamily: 'var(--home-font-display)' }}
            >
              {copy.businessCtaLabel}
              <ArrowRight size={14} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* App panel */}
          <div className="border border-[var(--home-border)] bg-[var(--home-bg)] p-7" style={{ borderRadius: '2px', boxShadow: '0 0 4px rgba(0, 245, 255, 0.06)' }} data-animate>
            <Smartphone className="text-[var(--home-accent)]" size={26} strokeWidth={1.7} aria-hidden="true" />
            <h2
              className="mt-5 text-2xl font-bold leading-tight text-start text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
            >
              {copy.appTitle}
            </h2>
            <p className="mt-3 text-[15px] text-[var(--home-muted)]" style={{ lineHeight: '1.5', fontFamily: 'var(--home-font-display)' }}>
              {copy.appBody}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[Download, Headphones, CheckCircle2].map((Icon, index) => {
                const featureLabels = [
                  copy.appFeatureOneLabel,
                  copy.appFeatureTwoLabel,
                  copy.appFeatureThreeLabel,
                ];
                return (
                  <div
                    key={featureLabels[index]}
                    className="border border-[var(--home-border)] bg-[var(--home-surface)] p-4"
                    style={{ borderRadius: '2px' }}
                  >
                    <Icon className="text-[var(--home-accent)]" size={18} strokeWidth={1.7} aria-hidden="true" />
                    <p
                      className="mt-3 text-xs font-bold text-[var(--home-text)]"
                      style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
                    >
                      {featureLabels[index]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. CONVERSION BAND                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="bg-[var(--home-bg)]"
        aria-labelledby="dark-tech-cta-heading"
        style={{
          paddingBlock: '72px',
          backgroundImage:
            'linear-gradient(var(--home-border) 1px, transparent 1px), linear-gradient(90deg, var(--home-border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="page-shell" style={{ maxInlineSize: '1280px', marginInline: 'auto' }}>
          <div
            className="grid gap-6 border border-[var(--home-accent)] bg-[var(--home-surface)] p-8 text-start lg:grid-cols-[1fr_auto] lg:items-center"
            style={{ boxShadow: '0 0 32px rgba(0, 245, 255, 0.12)', borderRadius: '2px' }}
            data-animate
          >
            <div>
              <h2
                id="dark-tech-cta-heading"
                className="text-2xl font-bold leading-tight text-[var(--home-text)] sm:text-3xl"
                style={{ fontFamily: 'var(--home-font-display)', lineHeight: '1.4' }}
              >
                {copy.finalTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-[15px] text-[var(--home-muted)]" style={{ lineHeight: '1.5', fontFamily: 'var(--home-font-display)' }}>
                {copy.finalBody}
              </p>
            </div>
            <Link
              className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 bg-[var(--home-accent)] px-7 text-sm font-bold text-[var(--home-button-text)] transition-all duration-200 ease-out hover:bg-[var(--home-accent-strong)] hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] ${focusRingClasses('dark-tech')} ${REDUCED_MOTION_OVERRIDE}`}
              href={copy.primaryCtaUrl || '/courses'}
              style={{ borderRadius: '2px', fontFamily: 'var(--home-font-display)' }}
            >
              {copy.primaryCtaLabel || copy.browseCatalogLabel || ui.common.browseCatalog}
              <ArrowRight size={15} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
