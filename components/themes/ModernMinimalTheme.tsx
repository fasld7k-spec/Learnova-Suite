import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  Download,
  Headphones,
  Quote,
  Search,
  Smartphone,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { localizedCopy } from '@/lib/localized-copy';
import { formatMoney, type HomeThemeSettings, type SiteSettings } from '@/lib/site-settings';
import type { HomeThemeId } from '@/lib/home-theme-registry';
import { focusRingClasses } from '@/lib/focus-ring';
import { cardHoverClasses, ctaHoverClasses, REDUCED_MOTION_OVERRIDE } from '@/lib/animation-classes';

// ---------------------------------------------------------------------------
// Types
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
// Helper: category label respecting RTL/Arabic
// ---------------------------------------------------------------------------

function catLabel(
  category: { nameEn: string; nameAr?: string | null },
  isRtl: boolean,
): string {
  return isRtl ? category.nameAr || category.nameEn : category.nameEn;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Modern Minimal course card — 10px radius, subtle border, soft shadow resting state.
 * Hover: -4px translateY + elevated shadow within 200ms ease-out.
 */
function MinimalCourseCard({
  course,
  copy,
  settings,
  isRtl,
}: {
  course: CourseWithRelations;
  copy: HomeThemeSettings;
  settings: SiteSettings;
  isRtl: boolean;
}) {
  const ui = localizedCopy(settings.defaultLanguage);
  const price = course.isFree
    ? copy.freeLabel || ui.courseCard.free
    : formatMoney(course.salePrice ?? course.price, settings.currency);

  return (
    <Link
      href={`/courses/${course.slug}`}
      data-animate
      className={`group flex flex-col rounded-[10px] border border-[var(--home-border)] bg-[var(--home-surface)] shadow-sm ${cardHoverClasses('modern-minimal')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('modern-minimal')}`}
    >
      {/* Thumbnail */}
      <div className="aspect-video overflow-hidden rounded-t-[10px] bg-[var(--home-surface-alt)]">
        {course.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.coverImage}
            alt=""
            aria-hidden="true"
            className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${REDUCED_MOTION_OVERRIDE}`}
          />
        ) : (
          <div className="grid h-full place-items-center text-[var(--home-accent)]">
            <BookOpen size={34} strokeWidth={1.7} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {course.category && (
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--home-accent)]">
            {catLabel(course.category, isRtl)}
          </p>
        )}
        <h3 className="mt-2 line-clamp-2 min-h-[3rem] text-base font-bold leading-snug text-[var(--home-text)]">
          {course.title}
        </h3>
        {course.shortDescription && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--home-muted)]" style={{ lineHeight: '1.6' }}>
            {course.shortDescription}
          </p>
        )}

        {/* Footer row */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--home-border)] pt-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[var(--home-muted)]">
            <UsersRound size={14} aria-hidden="true" />
            {course.enrollments?.length ?? 0}
          </span>
          <span className="font-bold text-[var(--home-text)]">{price}</span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ModernMinimalTheme — Theme 1
 *
 * Layout:
 *  1. Split hero: text + CTAs left, featured course card right (lg:grid-cols-2)
 *  2. Horizontal category pill rail (scrollable on mobile)
 *  3. Flat card grid (grid-cols-1 sm:grid-cols-2 xl:grid-cols-3)
 *  4. Instructors + reviews section
 *  5. Business / app section
 *  6. Conversion band
 *
 * Requirements: 2.5, 2.6, 2.7, 6.1, 11.1–11.4, 12.1–12.4
 */
export function ModernMinimalTheme({
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
  const heroCourse = courses[0];
  const featuredCourses = courses.slice(0, 6);
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

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* 1. SPLIT HERO                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="relative overflow-hidden border-b border-[var(--home-border)] bg-[var(--home-bg)]"
        aria-labelledby="hero-heading"
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
            style={{
              background: 'var(--home-hero-overlay)',
              opacity: 'var(--home-hero-overlay-opacity)' as string,
            }}
          />
        )}

        {/*
          Split layout: text leading, visual trailing.
          Single-column stacked on mobile (≤768px), two-column split on desktop (md+).
          CSS logical properties handle RTL mirroring automatically.
        */}
        <div
          className="page-shell relative grid max-w-[1280px] items-center gap-10 py-12 md:grid-cols-2 md:py-20 lg:py-24"
          style={{
            paddingInlineStart: 'clamp(1.5rem, 4vw, 3rem)',
            paddingInlineEnd: 'clamp(1.5rem, 4vw, 3rem)',
          }}
        >
          {/* Leading column — headline, subtitle, CTAs */}
          <div className="text-start">
            <h1
              id="hero-heading"
              className="max-w-2xl text-[28px] font-bold leading-tight tracking-tight text-[var(--home-text)] sm:text-4xl md:text-5xl"
              style={{
                fontFamily: 'var(--home-font-display)',
                lineHeight: '1.15',
              }}
            >
              {copy.heroTitle || slide?.title}
            </h1>
            <p
              className="mt-5 max-w-xl text-base leading-relaxed text-[var(--home-muted)] md:text-lg"
              style={{ lineHeight: '1.6' }}
            >
              {copy.heroSubtitle || slide?.subtitle}
            </p>

            {/* Search bar */}
            <form
              className="mt-8 flex max-w-lg overflow-hidden border border-[var(--home-border)] bg-[var(--home-surface)]"
              style={{ borderRadius: 'var(--home-radius)' }}
              action="/courses"
            >
              <div className="grid w-12 place-items-center text-[var(--home-muted)]">
                <Search size={18} strokeWidth={1.8} />
              </div>
              <input
                className={`min-w-0 flex-1 bg-transparent px-1 text-sm text-[var(--home-text)] outline-none placeholder:text-[var(--home-muted)] ${focusRingClasses('modern-minimal')}`}
                name="q"
                placeholder={copy.searchPlaceholder || ui.common.search}
              />
              <button
                type="submit"
                className={`m-1 hidden min-h-[44px] min-w-[44px] items-center gap-2 bg-[var(--home-accent)] px-5 text-sm font-semibold text-[var(--home-button-text)] sm:inline-flex ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('modern-minimal')}`}
                style={{ borderRadius: 'var(--home-radius)' }}
              >
                {copy.primaryCtaLabel || ui.common.search}
              </button>
            </form>

            {/* Primary + Secondary CTA buttons */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 bg-[var(--home-accent)] px-6 text-sm font-semibold text-[var(--home-button-text)] ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('modern-minimal')}`}
                style={{
                  borderRadius: 'var(--home-radius)',
                  paddingInlineStart: '1.5rem',
                  paddingInlineEnd: '1.5rem',
                }}
                href={copy.primaryCtaUrl || slide?.buttonUrl || '/courses'}
              >
                {copy.primaryCtaLabel || slide?.buttonText || copy.browseCatalogLabel || ui.common.browseCatalog}
                <ArrowRight size={16} className="rtl:-scale-x-100" />
              </Link>
              {settings.registrationEnabled && settings.instructorsEnabled && (
                <Link
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 border border-[var(--home-border)] bg-[var(--home-surface)] px-6 text-sm font-semibold text-[var(--home-text)] ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('modern-minimal')}`}
                  style={{
                    borderRadius: 'var(--home-radius)',
                    paddingInlineStart: '1.5rem',
                    paddingInlineEnd: '1.5rem',
                  }}
                  href={copy.secondaryCtaUrl || '/register?role=INSTRUCTOR'}
                >
                  {copy.secondaryCtaLabel || ui.dashboard.roleLabels.instructor}
                </Link>
              )}
            </div>
          </div>

          {/* Trailing column — featured course card or abstract graphic */}
          <div
            className="border border-[var(--home-border)] bg-[var(--home-surface)]"
            style={{
              borderRadius: 'var(--home-radius-card)',
              paddingInline: '1.25rem',
              paddingBlock: '1.25rem',
            }}
          >
            {heroCourse ? (
              <Link
                href={`/courses/${heroCourse.slug}`}
                className={`block ${focusRingClasses('modern-minimal')}`}
                style={{ borderRadius: 'var(--home-radius-card)' }}
              >
                {heroCourse.coverImage && (
                  <div
                    className="mb-4 overflow-hidden border border-[var(--home-border)] bg-[var(--home-surface-alt)]"
                    style={{ marginBlockEnd: '1rem' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroCourse.coverImage}
                      alt=""
                      aria-hidden="true"
                      className={`aspect-video w-full object-cover transition duration-300 hover:scale-105 ${REDUCED_MOTION_OVERRIDE}`}
                    />
                  </div>
                )}
                {heroCourse.category && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--home-accent)]">
                    {catLabel(heroCourse.category, isRtl)}
                  </p>
                )}
                <h2
                  className="mt-2 text-xl font-bold leading-snug text-[var(--home-text)]"
                  style={{
                    fontFamily: 'var(--home-font-display)',
                    marginBlockStart: '0.5rem',
                  }}
                >
                  {heroCourse.title}
                </h2>
                {heroCourse.shortDescription && (
                  <p
                    className="line-clamp-3 text-sm text-[var(--home-muted)]"
                    style={{ marginBlockStart: '0.5rem', lineHeight: '1.6' }}
                  >
                    {heroCourse.shortDescription}
                  </p>
                )}
                <div
                  className="flex items-center justify-between gap-3 border-t border-[var(--home-border)] text-sm"
                  style={{ marginBlockStart: '1rem', paddingBlockStart: '1rem' }}
                >
                  <span className="inline-flex items-center gap-1.5 text-[var(--home-muted)]">
                    <UsersRound size={14} />
                    {heroCourse.enrollments?.length ?? 0}
                  </span>
                  <span className="font-bold text-[var(--home-text)]">
                    {heroCourse.isFree
                      ? copy.freeLabel || ui.courseCard.free
                      : formatMoney(heroCourse.salePrice ?? heroCourse.price, settings.currency)}
                  </span>
                </div>
              </Link>
            ) : (
              /* Abstract graphic fallback when no courses */
              <div className="grid min-h-64 place-items-center">
                <div className="flex flex-col items-center gap-4 text-[var(--home-muted)]">
                  <BookOpen size={48} strokeWidth={1.4} className="text-[var(--home-accent)]" aria-hidden="true" />
                  <p className="text-sm font-medium">{copy.emptyStateLabel}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. CATEGORY PILL RAIL                                               */}
      {/* ------------------------------------------------------------------ */}
      {categories.length > 0 && (
        <section
          className="border-b border-[var(--home-border)] bg-[var(--home-surface)] py-4"
          aria-label="Categories"
        >
          <div className="page-shell">
            <div
              className={`scrollbar-none flex gap-2 overflow-x-auto pb-1 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            >
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 border border-[var(--home-border)] bg-[var(--home-surface)] px-4 text-sm font-medium text-[var(--home-text)] transition-all duration-200 ease-out hover:bg-[var(--home-surface-alt)] hover:text-[var(--home-accent)] ${focusRingClasses('modern-minimal')}`}
                  style={{ borderRadius: 'var(--home-radius)' }}
                >
                  <Sparkles size={13} strokeWidth={1.7} className="text-[var(--home-accent)]" aria-hidden="true" />
                  {catLabel(category, isRtl)}
                  {category._count?.courses !== undefined && (
                    <span className="text-[var(--home-muted)]">({category._count.courses})</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. FEATURED COURSES GRID                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="bg-[var(--home-bg)] py-20"
        aria-label="Featured courses"
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell">
          <div
            className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            data-animate
          >
            <div className="text-start">
              <h2
                className="text-2xl font-bold text-[var(--home-text)] sm:text-3xl"
                style={{ fontFamily: 'var(--home-font-display)', letterSpacing: '-0.02em' }}
              >
                {copy.featuredTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-[var(--home-muted)]" style={{ lineHeight: '1.6' }}>{copy.featuredSubtitle}</p>
            </div>
            <Link
              className={`inline-flex items-center gap-2 border border-[var(--home-border)] bg-[var(--home-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--home-text)] transition-all duration-200 ease-out hover:bg-[var(--home-surface-alt)] ${focusRingClasses('modern-minimal')}`}
              style={{ borderRadius: 'var(--home-radius)' }}
              href="/courses"
            >
              {copy.browseAllLabel || ui.common.browseCatalog}
              <ArrowRight size={15} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* Course card grid */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {featuredCourses.length ? (
              featuredCourses.map((course) => (
                <MinimalCourseCard
                  key={course.id}
                  course={course}
                  copy={copy}
                  settings={settings}
                  isRtl={isRtl}
                />
              ))
            ) : (
              <p className="col-span-full text-sm text-[var(--home-muted)]">
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. INSTRUCTORS + REVIEWS                                            */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="bg-[var(--home-surface)] py-20"
        aria-label="Instructors and reviews"
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Instructors */}
          <div className="text-start" data-animate>
            <h2
              className="text-2xl font-bold text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)', letterSpacing: '-0.02em' }}
            >
              {copy.instructorNetworkTitle || copy.storiesTitle}
            </h2>
            <p className="mt-2 text-[var(--home-muted)]" style={{ lineHeight: '1.6' }}>{copy.storiesBody}</p>
            <div className="mt-6 grid gap-1">
              {instructors.length ? (
                instructors.map((instructor) => (
                  <Link
                    key={instructor.id}
                    href={`/instructors/${instructor.id}`}
                    className={`flex items-center gap-4 border-b border-[var(--home-border)] py-4 transition-all duration-200 ease-out hover:text-[var(--home-accent)] ${focusRingClasses('modern-minimal')} ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[var(--home-border)] bg-[var(--home-surface-alt)] text-sm font-bold text-[var(--home-accent)]">
                      {instructor.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[var(--home-text)]">{instructor.name}</b>
                      <span className="mt-0.5 line-clamp-1 text-sm text-[var(--home-muted)]">
                        {instructor.bio || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-[var(--home-muted)]">
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
                  className="rounded-[10px] border border-[var(--home-border)] bg-[var(--home-bg)] p-5 shadow-sm"
                >
                  <Quote className="text-[var(--home-accent)]" size={20} strokeWidth={1.7} aria-hidden="true" />
                  <p className="mt-3 text-base font-medium leading-7 text-[var(--home-text)]" style={{ lineHeight: '1.6' }}>
                    {review.comment || copy.storiesBody}
                  </p>
                  <div
                    className={`mt-4 flex items-center justify-between gap-4 border-t border-[var(--home-border)] pt-4 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                  >
                    <span className="text-sm font-semibold text-[var(--home-muted)]">
                      {review.user?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--home-accent)]">
                      <Award size={14} aria-hidden="true" />
                      {review.rating}/5
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <article
                className="rounded-[10px] border border-[var(--home-border)] bg-[var(--home-bg)] p-5 text-[var(--home-muted)]"
              >
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
        className="bg-[var(--home-bg)] py-20"
        aria-label="Business and app"
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell grid gap-6 lg:grid-cols-2">
          {/* Business panel */}
          <div
            className="rounded-[10px] border border-[var(--home-border)] bg-[var(--home-surface)] p-7 shadow-sm"
            data-animate
          >
            <Building2 className="text-[var(--home-accent)]" size={26} strokeWidth={1.7} aria-hidden="true" />
            <h2
              className="mt-5 text-2xl font-bold leading-tight text-start text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)', letterSpacing: '-0.02em' }}
            >
              {copy.businessTitle}
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-[var(--home-muted)]" style={{ lineHeight: '1.6' }}>{copy.businessBody}</p>
            <Link
              className={`mt-6 inline-flex min-h-[44px] min-w-[44px] items-center gap-2 bg-[var(--home-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--home-button-text)] ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('modern-minimal')}`}
              style={{ borderRadius: 'var(--home-radius)' }}
              href="/partners"
            >
              {copy.businessCtaLabel}
              <ArrowRight size={15} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* App panel */}
          <div
            className="rounded-[10px] border border-[var(--home-border)] bg-[var(--home-surface)] p-7 shadow-sm"
            data-animate
          >
            <Smartphone className="text-[var(--home-accent)]" size={26} strokeWidth={1.7} aria-hidden="true" />
            <h2
              className="mt-5 text-2xl font-bold leading-tight text-start text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)', letterSpacing: '-0.02em' }}
            >
              {copy.appTitle}
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-[var(--home-muted)]" style={{ lineHeight: '1.6' }}>{copy.appBody}</p>
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
                    className="rounded-[10px] border border-[var(--home-border)] bg-[var(--home-bg)] p-4"
                  >
                    <Icon className="text-[var(--home-accent)]" size={18} strokeWidth={1.7} aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-[var(--home-text)]">
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
        className="bg-[var(--home-surface)] py-20"
        aria-label="Call to action"
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell">
          <div
            className={`grid gap-6 rounded-[10px] border border-[var(--home-border)] bg-[var(--home-bg)] p-8 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center text-start`}
            data-animate
          >
            <div>
              <h2
                className="text-2xl font-bold leading-tight text-[var(--home-text)] sm:text-3xl"
                style={{ fontFamily: 'var(--home-font-display)', letterSpacing: '-0.02em' }}
              >
                {copy.finalTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--home-muted)]" style={{ lineHeight: '1.6' }}>
                {copy.finalBody}
              </p>
            </div>
            <Link
              className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 bg-[var(--home-accent)] px-7 text-sm font-semibold text-[var(--home-button-text)] ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('modern-minimal')}`}
              style={{ borderRadius: 'var(--home-radius)' }}
              href={copy.primaryCtaUrl || '/courses'}
            >
              {copy.primaryCtaLabel || copy.browseCatalogLabel || ui.common.browseCatalog}
              <ArrowRight size={16} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
