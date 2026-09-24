import Link from 'next/link';
import { ArrowRight, Award, BookOpen, GraduationCap, Quote, Shield, Star, Users } from 'lucide-react';
import { localizedCopy } from '@/lib/localized-copy';
import { formatMoney, type SiteSettings } from '@/lib/site-settings';
import type { HomeThemeId } from '@/lib/home-theme-registry';
import { focusRingClasses } from '@/lib/focus-ring';
import { cardHoverClasses, ctaHoverClasses, REDUCED_MOTION_OVERRIDE } from '@/lib/animation-classes';

// ---------------------------------------------------------------------------
// CLASSIC ACADEMIC THEME — ClassicAcademicTheme
// Inspired by scholarly institutions: warm parchment tones, serif typography,
// structured layouts, academic trust signals, and institutional warmth.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared types (mirror the shapes defined in app/page.tsx)
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

export function ClassicAcademicTheme({
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

  const categoryLabel = (cat: { nameEn: string; nameAr?: string | null }) =>
    isRtl ? cat.nameAr || cat.nameEn : cat.nameEn;

  const heroImage = copy.heroImageUrl || slide?.image;
  const featuredCourses = courses.slice(0, 6);

  // Pick a testimonial: prefer reviews, fall back to first course review, then null
  const featuredReview =
    reviews[0] ??
    (courses[0]?.reviews?.[0]
      ? { ...courses[0].reviews[0], user: null, course: courses[0] }
      : null);

  // Stats for the hero right panel
  const stats = [
    { label: copy.counterCoursesLabel || ui.home.counters[0], value: courses.length },
    { label: copy.counterCategoriesLabel || ui.home.counters[1], value: categories.length },
    { label: copy.counterInstructorsLabel || ui.home.counters[2], value: instructors.length },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--home-bg)',
        color: 'var(--home-text)',
        fontFamily: 'var(--home-font-family)',
      }}
    >
      {/* ── Hero — Centered Prospectus Layout ────────────────────────────── */}
      <section
        className="relative border-b border-[var(--home-border)]"
        aria-label="Hero"
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
            aria-hidden="true"
            style={{
              backgroundColor: 'var(--home-hero-overlay)',
              opacity: 'var(--home-hero-overlay-opacity)' as string,
            }}
          />
        )}

        <div className="relative mx-auto max-w-[1280px] px-6 py-16 md:px-8 md:py-20 lg:py-24">
          {/* Centered headline block */}
          <div className="mx-auto max-w-3xl text-center">
            <p
              className="mb-4 text-sm font-semibold uppercase tracking-widest"
              style={{ color: 'var(--home-accent)' }}
            >
              {copy.recommendedTitle}
            </p>
            <h1
              className="text-[28px] font-bold leading-tight sm:text-4xl lg:text-5xl"
              style={{
                fontFamily: 'var(--home-font-display)',
                color: 'var(--home-text)',
              }}
            >
              {copy.heroTitle || slide?.title}
            </h1>
            <p
              className="mx-auto mt-5 max-w-2xl text-lg"
              style={{
                color: 'var(--home-muted)',
                fontFamily: 'Georgia, serif',
                lineHeight: '1.75',
              }}
            >
              {copy.heroSubtitle || slide?.subtitle}
            </p>

            {/* Academic credential badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--home-border)] bg-[var(--home-surface)] px-3 py-1.5 text-xs font-medium text-[var(--home-text)]">
                <Shield size={13} className="text-[var(--home-accent)]" aria-hidden="true" />
                {copy.approvedInstructorLabel || ui.home.approvedInstructor}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--home-border)] bg-[var(--home-surface)] px-3 py-1.5 text-xs font-medium text-[var(--home-text)]">
                <Award size={13} className="text-[var(--home-accent)]" aria-hidden="true" />
                {copy.panelTitle || ui.home.counters[0]}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--home-border)] bg-[var(--home-surface)] px-3 py-1.5 text-xs font-medium text-[var(--home-text)]">
                <GraduationCap size={13} className="text-[var(--home-accent)]" aria-hidden="true" />
                {copy.counterInstructorsLabel || ui.home.counters[2]}
              </span>
            </div>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href={copy.primaryCtaUrl || slide?.buttonUrl || '/courses'}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 px-7 py-3 text-sm font-semibold ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('classic-academic')}`}
                style={{
                  backgroundColor: 'var(--home-accent)',
                  color: 'var(--home-button-text)',
                  borderRadius: 'var(--home-radius)',
                }}
              >
                {copy.primaryCtaLabel || slide?.buttonText || ui.common.browseCatalog}
                <ArrowRight size={16} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
              </Link>
              {settings.registrationEnabled && settings.instructorsEnabled && (
                <Link
                  href={copy.secondaryCtaUrl || '/register?role=INSTRUCTOR'}
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 border px-7 py-3 text-sm font-semibold ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('classic-academic')}`}
                  style={{
                    borderColor: 'var(--home-border)',
                    color: 'var(--home-text)',
                    borderRadius: 'var(--home-radius)',
                  }}
                >
                  {copy.secondaryCtaLabel || ui.dashboard.roleLabels.instructor}
                </Link>
              )}
            </div>
          </div>

          {/* Structured stats panel */}
          <div
            className="mx-auto mt-12 max-w-2xl border border-[var(--home-border)] p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--home-surface)',
              borderRadius: 'var(--home-radius-card)',
              boxShadow: 'var(--home-shadow)',
            }}
          >
            <p className="mb-5 text-center text-xs font-bold uppercase tracking-widest text-[var(--home-accent)]">
              {copy.panelTitle}
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-[var(--home-border)] text-center">
              {stats.map(({ label, value }) => (
                <div key={label} className="px-3 py-2 first:ps-0 last:pe-0">
                  <p
                    className="text-2xl font-bold text-[var(--home-text)]"
                    style={{ fontFamily: 'var(--home-font-display)' }}
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-[var(--home-muted)]">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Featured testimonial inside panel */}
            {featuredReview ? (
              <blockquote className="mt-6 border-t border-[var(--home-border)] pt-5">
                <Quote size={20} className="mb-3 text-[var(--home-accent)]" aria-hidden="true" />
                <p
                  className="text-base italic text-[var(--home-text)]"
                  style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
                >
                  {featuredReview.comment || copy.storiesBody}
                </p>
                <footer className="mt-4 flex items-center justify-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--home-accent-soft)] text-sm font-bold text-[var(--home-accent)]">
                    {(featuredReview.user?.name || copy.approvedInstructorLabel || 'L').slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--home-text)]">
                      {featuredReview.user?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                    </p>
                    {featuredReview.rating != null && (
                      <p className="flex items-center gap-1 text-xs text-[var(--home-muted)]">
                        <Star size={11} fill="currentColor" className="text-[var(--home-accent)]" aria-hidden="true" />
                        {featuredReview.rating}/5
                      </p>
                    )}
                  </div>
                </footer>
              </blockquote>
            ) : (
              <p
                className="mt-6 border-t border-[var(--home-border)] pt-5 text-center text-sm italic text-[var(--home-muted)]"
                style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
              >
                {copy.panelSubtitle}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Decorative horizontal rule between sections ──────────────────── */}
      <div className="mx-auto max-w-[1280px] px-6 md:px-8" aria-hidden="true">
        <hr
          className="border-t border-[var(--home-border)]"
          style={{ marginBlock: '0' }}
        />
      </div>

      {/* ── Featured Testimonial / Instructor Quote Section ──────────────── */}
      <section
        className="bg-[var(--home-surface)]"
        style={{ paddingBlock: '80px' }}
        aria-labelledby="stories-heading"
      >
        <div className="mx-auto max-w-[1280px] px-6 md:px-8">
          <div className="mb-10 text-center" data-animate>
            <h2
              id="stories-heading"
              className="text-3xl font-bold text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)' }}
            >
              {copy.storiesTitle}
            </h2>
            <p
              className="mt-3 text-base text-[var(--home-muted)]"
              style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
            >
              {copy.storiesBody}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Testimonial cards from reviews */}
            {reviews.slice(0, 3).length > 0
              ? reviews.slice(0, 3).map((review) => (
                  <article
                    key={review.id}
                    data-animate
                    className={`flex flex-col border border-[var(--home-border)] bg-[var(--home-bg)] p-6 ${cardHoverClasses('classic-academic')} ${REDUCED_MOTION_OVERRIDE}`}
                    style={{
                      borderRadius: 'var(--home-radius-card)',
                      boxShadow: 'var(--home-shadow)',
                      borderInlineStart: '3px solid var(--home-accent)',
                    }}
                  >
                    <Quote size={18} className="mb-4 text-[var(--home-accent)]" aria-hidden="true" />
                    <p
                      className="flex-1 text-sm italic text-[var(--home-text)]"
                      style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
                    >
                      {review.comment || copy.storiesBody}
                    </p>
                    <footer
                      className="mt-5 flex items-center justify-between border-t border-[var(--home-border)] pt-4"
                    >
                      <span className="text-sm font-semibold text-[var(--home-text)]">
                        {review.user?.name || copy.approvedInstructorLabel || ui.home.approvedInstructor}
                      </span>
                      {review.rating != null && (
                        <span
                          className="flex items-center gap-1 text-xs font-bold text-[var(--home-accent)]"
                        >
                          <Star size={12} fill="currentColor" aria-hidden="true" />
                          {review.rating}/5
                        </span>
                      )}
                    </footer>
                  </article>
                ))
              : /* Instructor quote cards as fallback */
                instructors.slice(0, 3).map((instructor) => (
                  <article
                    key={instructor.id}
                    data-animate
                    className={`flex flex-col border border-[var(--home-border)] bg-[var(--home-bg)] p-6 ${cardHoverClasses('classic-academic')} ${REDUCED_MOTION_OVERRIDE}`}
                    style={{
                      borderRadius: 'var(--home-radius-card)',
                      boxShadow: 'var(--home-shadow)',
                      borderInlineStart: '3px solid var(--home-accent)',
                    }}
                  >
                    <Quote size={18} className="mb-4 text-[var(--home-accent)]" aria-hidden="true" />
                    <p
                      className="flex-1 text-sm italic text-[var(--home-text)]"
                      style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
                    >
                      {instructor.bio || copy.storiesBody}
                    </p>
                    <footer
                      className="mt-5 flex items-center gap-3 border-t border-[var(--home-border)] pt-4"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--home-accent-soft)] text-sm font-bold text-[var(--home-accent)]"
                      >
                        {instructor.name.slice(0, 1)}
                      </span>
                      <span className="text-sm font-semibold text-[var(--home-text)]">
                        {instructor.name}
                      </span>
                    </footer>
                  </article>
                ))}

            {/* Empty state */}
            {reviews.length === 0 && instructors.length === 0 && (
              <p className="col-span-full text-center text-sm text-[var(--home-muted)]">
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Decorative horizontal rule between sections ──────────────────── */}
      <div className="mx-auto max-w-[1280px] px-6 md:px-8" aria-hidden="true">
        <hr
          className="border-t border-[var(--home-border)]"
          style={{ marginBlock: '0' }}
        />
      </div>

      {/* ── Course Card-List ─────────────────────────────────────────────── */}
      <section
        className="bg-[var(--home-bg)]"
        style={{ paddingBlock: '80px' }}
        aria-labelledby="featured-heading"
      >
        <div className="mx-auto max-w-[1280px] px-6 md:px-8">
          <div className={`mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRtl ? 'rtl:flex-row-reverse' : ''}`} data-animate>
            <div>
              <h2
                id="featured-heading"
                className="text-3xl font-bold text-[var(--home-text)]"
                style={{ fontFamily: 'var(--home-font-display)' }}
              >
                {copy.featuredTitle}
              </h2>
              <p
                className="mt-2 max-w-2xl text-base text-[var(--home-muted)]"
                style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
              >
                {copy.featuredSubtitle}
              </p>
            </div>
            <Link
              href="/courses"
              className={`inline-flex shrink-0 items-center gap-2 border border-[var(--home-border)] px-5 py-2.5 text-sm font-semibold text-[var(--home-text)] transition-colors hover:opacity-80 ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('classic-academic')}`}
              style={{
                borderRadius: 'var(--home-radius)',
              }}
            >
              {copy.browseAllLabel || ui.common.browseCatalog}
              <ArrowRight size={15} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* Syllabus list — course cards with warm surface, serif titles, leading-edge border accent */}
          <div className="grid gap-3">
            {featuredCourses.length > 0 ? (
              featuredCourses.map((course, index) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  data-animate
                  className={`group grid overflow-hidden border border-[var(--home-border)] md:grid-cols-[190px_1fr] ${cardHoverClasses('classic-academic')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('classic-academic')}`}
                  style={{
                    backgroundColor: 'var(--home-surface)',
                    borderRadius: 'var(--home-radius-card)',
                    boxShadow: 'var(--home-shadow)',
                    borderInlineStart: '3px solid var(--home-accent)',
                  }}
                >
                  {/* Course thumbnail */}
                  <div
                    className="aspect-video overflow-hidden md:aspect-auto md:min-h-40"
                    style={{
                      backgroundColor: 'var(--home-surface-alt)',
                    }}
                  >
                    {course.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.coverImage}
                        alt=""
                        aria-hidden="true"
                        className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${REDUCED_MOTION_OVERRIDE}`}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[var(--home-accent)]">
                        <BookOpen size={32} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--home-accent)]">
                        Unit {(index + 1).toString().padStart(2, '0')}
                        {course.category ? ` · ${categoryLabel(course.category)}` : ''}
                      </p>
                      <h3
                        className="line-clamp-2 text-xl font-bold leading-snug text-[var(--home-text)]"
                        style={{ fontFamily: 'var(--home-font-display)' }}
                      >
                        {course.title}
                      </h3>
                      {course.shortDescription && (
                        <p
                          className="mt-2 line-clamp-2 text-sm text-[var(--home-muted)]"
                          style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
                        >
                          {course.shortDescription}
                        </p>
                      )}
                    </div>

                    {/* Footer row: instructor name + price */}
                    <div className="md:min-w-52">
                      <hr className="border-[var(--home-border)] md:hidden" aria-hidden="true" />
                      <div
                        className={`mt-3 flex items-center justify-between gap-3 text-sm md:mt-0 md:grid md:justify-items-end ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                      >
                        <span className="flex items-center gap-1.5 truncate text-[var(--home-muted)]">
                          <GraduationCap size={14} aria-hidden="true" />
                          <span className="truncate">
                            {course.instructor?.name ||
                              copy.approvedInstructorLabel ||
                              ui.home.approvedInstructor}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold text-[var(--home-text)]">
                          {course.isFree
                            ? copy.freeLabel || ui.courseCard.free
                            : formatMoney(course.salePrice ?? course.price, settings.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="col-span-full py-10 text-center text-sm text-[var(--home-muted)]">
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Decorative horizontal rule between sections ──────────────────── */}
      <div className="mx-auto max-w-[1280px] px-6 md:px-8" aria-hidden="true">
        <hr
          className="border-t border-[var(--home-border)]"
          style={{ marginBlock: '0' }}
        />
      </div>

      {/* ── Business / Team Learning Section ─────────────────────────────── */}
      <section
        className="bg-[var(--home-surface)]"
        style={{ paddingBlock: '80px' }}
        aria-labelledby="business-heading"
      >
        <div className="mx-auto max-w-[1280px] px-6 md:px-8 grid gap-10 lg:grid-cols-2 lg:items-center">
          {/* Leading: business copy */}
          <div className="text-start" data-animate>
            <Users
              size={32}
              strokeWidth={1.5}
              className="mb-5 text-[var(--home-accent)]"
              aria-hidden="true"
            />
            <h2
              id="business-heading"
              className="text-3xl font-bold leading-tight text-[var(--home-text)]"
              style={{ fontFamily: 'var(--home-font-display)' }}
            >
              {copy.businessTitle}
            </h2>
            <p
              className="mt-4 text-base text-[var(--home-muted)]"
              style={{ fontFamily: 'Georgia, serif', lineHeight: '1.75' }}
            >
              {copy.businessBody}
            </p>
            <Link
              href="/partners"
              className={`mt-7 inline-flex min-h-[44px] min-w-[44px] items-center gap-2 bg-[var(--home-accent)] px-6 py-3 text-sm font-semibold text-[var(--home-button-text)] ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('classic-academic')}`}
              style={{
                borderRadius: 'var(--home-radius)',
              }}
            >
              {copy.businessCtaLabel}
              <ArrowRight size={16} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* Trailing: category list */}
          <div
            data-animate
            className="border border-[var(--home-border)] p-6"
            style={{
              borderRadius: 'var(--home-radius-card)',
              backgroundColor: 'var(--home-bg)',
              boxShadow: 'var(--home-shadow)',
              borderInlineStart: '3px solid var(--home-accent)',
            }}
          >
            <p
              className="mb-4 text-sm font-bold uppercase tracking-widest text-[var(--home-accent)]"
            >
              {copy.recommendedTitle}
            </p>
            <ul className="divide-y divide-[var(--home-border)]">
              {categories.slice(0, 5).map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className={`flex items-center justify-between gap-3 py-3 text-sm font-medium text-[var(--home-text)] transition-colors hover:text-[var(--home-accent)] hover:underline ${focusRingClasses('classic-academic')} ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                  >
                    <span>{categoryLabel(category)}</span>
                    <span className="shrink-0 text-xs text-[var(--home-muted)]">
                      {category._count?.courses ?? 0}{' '}
                      {copy.counterCoursesLabel || ui.home.counters[0]}
                    </span>
                  </Link>
                </li>
              ))}
              {categories.length === 0 && (
                <li className="py-3 text-sm text-[var(--home-muted)]">
                  {copy.emptyStateLabel}
                </li>
              )}
            </ul>
            <Link
              href="/categories"
              className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--home-accent)] hover:underline ${focusRingClasses('classic-academic')} ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            >
              {copy.browseAllLabel || ui.common.browseCatalog}
              <ArrowRight size={14} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
