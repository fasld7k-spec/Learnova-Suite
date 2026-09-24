import Link from 'next/link';
import { ArrowRight, BookOpen, Quote } from 'lucide-react';
import { localizedCopy } from '@/lib/localized-copy';
import { formatMoney, type SiteSettings } from '@/lib/site-settings';
import type { HomeThemeId } from '@/lib/home-theme-registry';
import { focusRingClasses } from '@/lib/focus-ring';
import { cardHoverClasses, ctaHoverClasses, REDUCED_MOTION_OVERRIDE } from '@/lib/animation-classes';

// ---------------------------------------------------------------------------
// EDITORIAL MAGAZINE THEME — Theme 5
// Aesthetic: editorial / magazine — masthead rule lines, drop caps, multi-
// column body text, pull quotes, classical proportions. Off-white pinkish
// background, deep editorial red accent, Cormorant Garamond display serif.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared types (mirror sibling theme components — kept local on purpose)
// ---------------------------------------------------------------------------

type CourseCategory = { id: string; nameEn: string; nameAr?: string | null; slug: string };

type CourseReview = {
  id: string;
  rating: number | null;
  comment: string | null;
};

type CourseInstructor = { id: string; name: string };

type CourseWithRelations = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImage: string | null;
  price: number;
  salePrice: number | null;
  isFree: boolean;
  category: CourseCategory | null;
  instructor: CourseInstructor | null;
  enrollments: { id: string }[];
  reviews: CourseReview[];
};

type ReviewWithUser = {
  id: string;
  rating: number | null;
  comment: string | null;
  user: { id: string; name: string } | null;
  course: { id: string; title: string } | null;
};

type SliderLike =
  | { title?: string; subtitle?: string; buttonText?: string; buttonUrl?: string; image?: string }
  | undefined;

type HomeThemeRenderProps = {
  themeId: HomeThemeId;
  courses: CourseWithRelations[];
  categories: { id: string; nameEn: string; nameAr?: string | null; slug: string; _count?: { courses: number } }[];
  instructors: { id: string; name: string; bio: string | null }[];
  reviews: ReviewWithUser[];
  slide: SliderLike;
  settings: SiteSettings;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function catLabel(
  category: { nameEn: string; nameAr?: string | null },
  isRtl: boolean,
): string {
  return isRtl ? category.nameAr || category.nameEn : category.nameEn;
}

/** Format an issue label like "ISSUE NO. 04 — MAY 2026". Server-stable so it
 *  produces the same string on the client to avoid hydration mismatches. */
function issueLabel(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const year = now.getUTCFullYear();
  // Issue number is week-of-year-ish; cheap, deterministic enough for display
  const start = Date.UTC(year, 0, 1);
  const diff = now.getTime() - start;
  const issue = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24 * 28)) + 1);
  const padded = issue.toString().padStart(2, '0');
  return `Issue No. ${padded} — ${month} ${year}`;
}

// ---------------------------------------------------------------------------
// Main component (Server Component — no "use client")
// ---------------------------------------------------------------------------

/**
 * EditorialMagazineTheme — Theme 5
 *
 * Layout:
 *  1. Masthead hero — rule lines top/bottom, eyebrow issue label, large serif title
 *  2. Drop-cap article opener — drop-cap first paragraph, multi-column body
 *  3. Editorial column grid — courses as magazine "stories" with byline + rule
 *  4. Pull-quote section — large italic serif quote between thin rules
 *  5. Curated reading list — ordered list with chapter numbers as eyebrows
 *  6. Editor's note CTA — final section styled as an editor's note + signature
 */
export function EditorialMagazineTheme({
  themeId,
  courses,
  categories: _categories,
  instructors,
  reviews,
  slide,
  settings,
}: HomeThemeRenderProps) {
  const copy = settings.homeThemes[themeId];
  const ui = localizedCopy(settings.defaultLanguage);
  const isRtl = settings.rtl;

  // Reference unused param so it's not flagged but still part of the contract
  void _categories;

  const heroImage = copy.heroImageUrl || slide?.image;
  const featureCourses = courses.slice(0, 6);
  const readingList = courses.slice(0, 5);

  // Pull quote: prefer reviews[0], fall back to first course review
  const pullQuote =
    reviews[0] ??
    (courses[0]?.reviews?.[0]
      ? {
          id: courses[0].reviews[0].id,
          rating: courses[0].reviews[0].rating,
          comment: courses[0].reviews[0].comment,
          user: null,
          course: { id: courses[0].id, title: courses[0].title },
        }
      : null);

  const editorName =
    instructors[0]?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor;

  return (
    <div
      style={{
        backgroundColor: 'var(--home-bg)',
        color: 'var(--home-text)',
        fontFamily: 'var(--home-font-family)',
      }}
    >
      {/* ── 1. MASTHEAD HERO ──────────────────────────────────────────── */}
      <section
        className="relative"
        aria-labelledby="masthead-headline"
      >
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {heroImage && (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: 'var(--home-hero-overlay)',
              opacity: 'var(--home-hero-overlay-opacity)' as string,
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative mx-auto max-w-[1280px] px-6 py-12 md:px-8 md:py-16 lg:px-12 lg:py-20">
          {/* Top editorial rule */}
          <hr
            className="border-t border-[var(--home-text)]"
            aria-hidden="true"
          />

          {/* Eyebrow: small caps issue / date label */}
          <div
            className="mt-5 flex flex-wrap items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-muted)]"
          >
            <span>{issueLabel()}</span>
            <span className="text-[var(--home-accent)]">{copy.recommendedTitle}</span>
          </div>

          {/* Large Cormorant Garamond masthead headline — responsive sizing */}
          <h1
            id="masthead-headline"
            className="mt-8 text-center text-[28px] font-bold leading-[1.05] sm:text-[36px] md:text-5xl lg:text-6xl xl:text-7xl"
            style={{ fontFamily: 'var(--home-font-display)', color: 'var(--home-text)' }}
          >
            {copy.heroTitle || slide?.title}
          </h1>

          {/* Subtitle — Inter body, constrained to 60-75ch line width */}
          <p
            className="mx-auto mt-6 max-w-prose text-center text-base leading-relaxed italic md:text-lg md:leading-8"
            style={{ color: 'var(--home-muted)', fontFamily: 'var(--home-font-display)' }}
          >
            {copy.heroSubtitle || slide?.subtitle}
          </p>

          {/* Double editorial rule (thin border + spacer + thin border) */}
          <div className="mt-8" aria-hidden="true">
            <hr className="border-t border-[var(--home-text)]" />
            <div className="h-[3px]" />
            <hr className="border-t border-[var(--home-text)]" />
          </div>

          {/* Drop-cap opening paragraph — Inter body, 60-75ch width */}
          <p
            className={`mx-auto mt-8 max-w-prose text-base leading-relaxed text-[var(--home-text)] md:text-[17px] md:leading-8 ${
              isRtl ? 'first-letter:float-right' : 'first-letter:float-left'
            } first-letter:me-3 first-letter:mt-1 first-letter:text-6xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-[var(--home-accent)] first-letter:[font-family:var(--home-font-display)]`}
            style={{ fontFamily: 'var(--home-font-family)' }}
          >
            {copy.panelSubtitle || copy.heroSubtitle || slide?.subtitle}
          </p>

          {/* Bottom editorial rule */}
          <hr
            className="mx-auto mt-8 max-w-prose border-t border-[var(--home-border)]"
            aria-hidden="true"
          />

          {/* CTAs centered under masthead — 44px min touch target */}
          <div
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap"
          >
            <Link
              href={copy.primaryCtaUrl || slide?.buttonUrl || '/courses'}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 px-7 py-3 text-sm font-semibold uppercase tracking-widest ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('editorial-magazine')}`}
              style={{
                backgroundColor: 'var(--home-accent)',
                color: 'var(--home-button-text)',
                borderRadius: 'var(--home-radius)',
              }}
            >
              {copy.primaryCtaLabel || slide?.buttonText || ui.common.browseCatalog}
              <ArrowRight size={14} className={isRtl ? 'rtl:rotate-180' : ''} />
            </Link>
            {settings.registrationEnabled && settings.instructorsEnabled && (
              <Link
                href={copy.secondaryCtaUrl || '/categories'}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 border px-7 py-3 text-sm font-semibold uppercase tracking-widest text-[var(--home-text)] ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('editorial-magazine')}`}
                style={{
                  borderColor: 'var(--home-text)',
                  borderRadius: 'var(--home-radius)',
                }}
              >
                {copy.secondaryCtaLabel || ui.dashboard.roleLabels.instructor}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. DROP-CAP ARTICLE OPENER ────────────────────────────────── */}
      <section
        className="border-t border-[var(--home-border)] py-14 sm:py-20"
        aria-label="Editor's letter"
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell">
          {/* Typographic section header with editorial rule */}
          <div className="mb-10 text-center" data-animate>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-accent)]">
              {copy.panelTitle}
            </p>
            <h2
              className="mt-3 text-3xl font-bold sm:text-4xl"
              style={{ fontFamily: 'var(--home-font-display)', color: 'var(--home-text)' }}
            >
              {copy.featuredTitle}
            </h2>
            <p
              className="mx-auto mt-3 max-w-2xl text-base italic text-[var(--home-muted)]"
              style={{ fontFamily: 'var(--home-font-display)' }}
            >
              {copy.featuredSubtitle}
            </p>
            {/* Editorial rule below header */}
            <hr className="mx-auto mt-6 w-24 border-t border-[var(--home-text)]" aria-hidden="true" />
          </div>

          {/* Drop-cap multi-column body — column layout 60-75ch */}
          <article
            className="mx-auto max-w-5xl text-[17px] leading-8 text-[var(--home-text)] md:[column-count:2] md:[column-gap:2.5rem] lg:[column-count:3] lg:[column-gap:3rem]"
            style={{ fontFamily: 'var(--home-font-family)' }}
            data-animate
          >
            <p
              className={`${isRtl ? 'first-letter:float-right' : 'first-letter:float-left'} first-letter:me-3 first-letter:mt-1 first-letter:text-7xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-[var(--home-accent)] first-letter:[font-family:var(--home-font-display)]`}
            >
              {copy.panelSubtitle}
            </p>
            <p className="mt-5">{copy.storiesBody}</p>
            <p className="mt-5">{copy.businessBody}</p>
            <p className="mt-5 italic text-[var(--home-muted)]">{copy.appBody}</p>
          </article>
        </div>
      </section>

      {/* ── 3. EDITORIAL COLUMN GRID (course "stories") ───────────────── */}
      <section
        className="border-t border-[var(--home-text)] bg-[var(--home-surface)] py-14 sm:py-20"
        aria-label={copy.featuredTitle}
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell">
          {/* Typographic section header with editorial rule */}
          <div
            className={`mb-10 flex flex-col items-baseline gap-3 border-b border-[var(--home-text)] pb-5 md:flex-row md:items-end md:justify-between ${
              isRtl ? 'rtl:flex-row-reverse' : ''
            }`}
            data-animate
          >
            <div className="text-start">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-accent)]">
                {copy.storiesTitle}
              </p>
              <h2
                className="mt-2 text-3xl font-bold sm:text-4xl"
                style={{ fontFamily: 'var(--home-font-display)', color: 'var(--home-text)' }}
              >
                {copy.featuredTitle}
              </h2>
            </div>
            <Link
              href="/courses"
              className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-2 text-sm font-semibold uppercase tracking-widest text-[var(--home-accent)] hover:underline ${focusRingClasses('editorial-magazine')} ${
                isRtl ? 'rtl:flex-row-reverse' : ''
              }`}
            >
              {copy.browseAllLabel || ui.common.browseCatalog}
              <ArrowRight size={14} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* Column grid — magazine-style course "stories" with 60-75ch max width */}
          <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {featureCourses.length > 0 ? (
              featureCourses.map((course) => (
                <article
                  key={course.id}
                  className="flex flex-col"
                  data-animate
                >
                  {/* Course card link — 0px radius, hairline border, no shadow, bg shift on hover */}
                  <Link
                    href={`/courses/${course.slug}`}
                    className={`group flex flex-col border border-[var(--home-border)] bg-[var(--home-surface)] ${cardHoverClasses('editorial-magazine')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('editorial-magazine')}`}
                    style={{ borderRadius: '0px' }}
                  >
                    {/* Thumbnail — 0px radius */}
                    {course.coverImage ? (
                      <div className="overflow-hidden bg-[var(--home-surface-alt)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={course.coverImage}
                          alt=""
                          aria-hidden="true"
                          className={`aspect-[4/3] w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02] ${REDUCED_MOTION_OVERRIDE}`}
                        />
                      </div>
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center bg-[var(--home-surface-alt)] text-[var(--home-accent)]">
                        <BookOpen size={36} strokeWidth={1.4} aria-hidden="true" />
                      </div>
                    )}

                    {/* Card body — editorial rule lines between metadata */}
                    <div className="flex flex-1 flex-col p-5">
                      {/* Category eyebrow */}
                      {course.category && (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--home-accent)]">
                          {catLabel(course.category, isRtl)}
                        </p>
                      )}

                      {/* Title — Cormorant Garamond, magazine typography */}
                      <h3
                        className="mt-2 line-clamp-2 text-2xl font-bold leading-tight text-[var(--home-text)] group-hover:underline"
                        style={{ fontFamily: 'var(--home-font-display)' }}
                      >
                        {course.title}
                      </h3>

                      {/* Editorial rule line between title and byline */}
                      <hr className="mt-3 border-t border-[var(--home-border)]" aria-hidden="true" />

                      {/* Byline — instructor name in italics */}
                      <p
                        className="mt-3 text-sm italic text-[var(--home-muted)]"
                        style={{ fontFamily: 'var(--home-font-display)' }}
                      >
                        <span className="not-italic text-[10px] font-semibold uppercase tracking-widest text-[var(--home-muted)]">
                          {copy.approvedInstructorLabel || ui.home.approvedInstructor}
                        </span>{' '}
                        <span>
                          {course.instructor?.name ||
                            copy.approvedInstructorLabel ||
                            ui.home.approvedInstructor}
                        </span>
                      </p>

                      {course.shortDescription && (
                        <p className="mt-3 line-clamp-3 max-w-[75ch] text-[15px] leading-7 text-[var(--home-muted)]">
                          {course.shortDescription}
                        </p>
                      )}

                      {/* Editorial rule line between description and meta */}
                      <hr className="mt-4 border-t border-[var(--home-border)]" aria-hidden="true" />

                      {/* Meta line: price • enrollments */}
                      <div
                        className={`mt-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-[var(--home-muted)] ${
                          isRtl ? 'rtl:flex-row-reverse' : ''
                        }`}
                      >
                        <span className="text-[var(--home-text)]">
                          {course.isFree
                            ? copy.freeLabel || ui.courseCard.free
                            : formatMoney(course.salePrice ?? course.price, settings.currency)}
                        </span>
                        <span aria-hidden="true">•</span>
                        <span>
                          {course.enrollments?.length ?? 0}{' '}
                          {ui.home.counters?.[0] || 'readers'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))
            ) : (
              <p className="col-span-full py-10 text-center text-sm italic text-[var(--home-muted)]">
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 4. PULL-QUOTE SECTION ─────────────────────────────────────── */}
      <section
        className="bg-[var(--home-bg)] py-20 sm:py-28"
        aria-label="Pull quote"
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell">
          <figure className="mx-auto max-w-4xl text-center" data-animate>
            {/* Top thin rule */}
            <hr className="mx-auto w-24 border-t-2 border-[var(--home-accent)]" aria-hidden="true" />

            <Quote
              size={28}
              className="mx-auto mt-8 text-[var(--home-accent)]"
              strokeWidth={1.4}
              aria-hidden="true"
            />

            <blockquote
              className="mt-6 text-3xl italic leading-snug text-[var(--home-text)] sm:text-4xl lg:text-5xl"
              style={{ fontFamily: 'var(--home-font-display)' }}
            >
              <p>“{pullQuote?.comment || copy.storiesBody}”</p>
            </blockquote>

            <figcaption className="mt-8 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-muted)]">
              {pullQuote?.user?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor}
              {pullQuote?.course?.title ? (
                <>
                  <span aria-hidden="true" className="mx-2">
                    /
                  </span>
                  <span className="text-[var(--home-accent)]">{pullQuote.course.title}</span>
                </>
              ) : null}
            </figcaption>

            {/* Bottom thin rule */}
            <hr className="mx-auto mt-10 w-24 border-t-2 border-[var(--home-accent)]" aria-hidden="true" />
          </figure>
        </div>
      </section>

      {/* ── 5. CURATED READING LIST ───────────────────────────────────── */}
      <section
        className="border-y border-[var(--home-border)] bg-[var(--home-surface)] py-14 sm:py-20"
        aria-label={copy.recommendedTitle}
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell">
          {/* Typographic section header with editorial rule */}
          <div
            className={`mb-10 flex flex-col gap-3 border-b border-[var(--home-text)] pb-5 text-start ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            data-animate
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-accent)]">
              {copy.recommendedTitle}
            </p>
            <h2
              className="text-3xl font-bold sm:text-4xl"
              style={{ fontFamily: 'var(--home-font-display)', color: 'var(--home-text)' }}
            >
              {copy.recommendedSubtitle}
            </h2>
          </div>

          {readingList.length > 0 ? (
            <ol className="grid gap-0 divide-y divide-[var(--home-border)] border-y border-[var(--home-border)]">
              {readingList.map((course, index) => {
                const chapter = (index + 1).toString().padStart(2, '0');
                return (
                  <li key={course.id} data-animate>
                    <Link
                      href={`/courses/${course.slug}`}
                      className={`group grid min-h-[44px] grid-cols-[auto_1fr_auto] items-baseline gap-4 py-6 ${cardHoverClasses('editorial-magazine')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('editorial-magazine')} sm:gap-8 ${
                        isRtl ? 'rtl:[direction:rtl]' : ''
                      }`}
                    >
                      {/* Chapter number eyebrow */}
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-accent)]"
                      >
                        {(copy.journeyStepLabel || 'Chapter')} {chapter}
                      </span>

                      {/* Title + byline */}
                      <span className="min-w-0">
                        <h3
                          className="truncate text-xl font-bold text-[var(--home-text)] group-hover:underline sm:text-2xl"
                          style={{ fontFamily: 'var(--home-font-display)' }}
                        >
                          {course.title}
                        </h3>
                        <span className="mt-1 block truncate text-sm italic text-[var(--home-muted)]">
                          {course.instructor?.name ||
                            copy.approvedInstructorLabel ||
                            ui.home.approvedInstructor}
                        </span>
                      </span>

                      {/* Price / read indicator */}
                      <span className="shrink-0 text-sm font-semibold text-[var(--home-text)]">
                        {course.isFree
                          ? copy.freeLabel || ui.courseCard.free
                          : formatMoney(course.salePrice ?? course.price, settings.currency)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-10 text-center text-sm italic text-[var(--home-muted)]">
              {copy.emptyStateLabel}
            </p>
          )}
        </div>
      </section>

      {/* ── 6. EDITOR'S NOTE CTA ──────────────────────────────────────── */}
      <section
        className="bg-[var(--home-bg)] py-16 sm:py-24"
        aria-label="Editor's note"
        data-scroll-animate
        style={{ paddingBlock: '80px' }}
      >
        <div className="page-shell">
          <article className="mx-auto max-w-3xl text-center" data-animate>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-accent)]">
              {copy.panelTitle}
            </p>
            <h2
              className="mt-4 text-3xl font-bold leading-tight sm:text-4xl"
              style={{ fontFamily: 'var(--home-font-display)', color: 'var(--home-text)' }}
            >
              {copy.finalTitle}
            </h2>

            <hr className="mx-auto mt-8 w-16 border-t border-[var(--home-text)]" aria-hidden="true" />

            <p
              className={`mt-8 text-start text-[17px] leading-8 text-[var(--home-text)] ${
                isRtl ? 'first-letter:float-right' : 'first-letter:float-left'
              } first-letter:me-2 first-letter:mt-1 first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-[var(--home-accent)] first-letter:[font-family:var(--home-font-display)]`}
            >
              {copy.finalBody}
            </p>

            {/* Signature block */}
            <div
              className={`mt-10 flex flex-col items-center gap-1 ${
                isRtl ? 'rtl:items-end' : ''
              }`}
            >
              <span
                className="text-2xl italic text-[var(--home-accent)]"
                style={{ fontFamily: 'var(--home-font-display)' }}
              >
                — {editorName}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--home-muted)]">
                {copy.approvedInstructorLabel || ui.home.approvedInstructor}
              </span>
            </div>

            <div
              className={`mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap ${
                isRtl ? 'rtl:flex-row-reverse' : ''
              }`}
            >
              <Link
                href={copy.primaryCtaUrl || '/courses'}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 px-7 py-3 text-sm font-semibold uppercase tracking-widest ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('editorial-magazine')}`}
                style={{
                  backgroundColor: 'var(--home-accent)',
                  color: 'var(--home-button-text)',
                  borderRadius: 'var(--home-radius)',
                }}
              >
                {copy.primaryCtaLabel || copy.browseCatalogLabel || ui.common.browseCatalog}
                <ArrowRight size={14} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default EditorialMagazineTheme;
