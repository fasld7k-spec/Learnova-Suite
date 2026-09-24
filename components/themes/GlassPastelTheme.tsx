import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Heart,
  Quote,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { localizedCopy } from '@/lib/localized-copy';
import { formatMoney, type SiteSettings } from '@/lib/site-settings';
import type { HomeThemeId } from '@/lib/home-theme-registry';
import { focusRingClasses } from '@/lib/focus-ring';
import { cardHoverClasses, ctaHoverClasses, REDUCED_MOTION_OVERRIDE } from '@/lib/animation-classes';

// ---------------------------------------------------------------------------
// GLASS PASTEL THEME — Theme 6
// Soft, dreamy glassmorphism aesthetic: pastel multi-color gradients, frosted
// glass cards (stronger blur than BoldVibrant), parallax blobs, hot pink neon
// accent, generous rounded corners, lifestyle-modern personality.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Local types (mirror sibling components in components/themes/*)
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
  category: { nameEn: string; nameAr?: string | null } | null;
  instructor: { name: string } | null;
  enrollments: { id: string }[];
  reviews: { id: string; rating: number; comment: string | null }[];
};

type SliderLike =
  | { title?: string; subtitle?: string; buttonText?: string; buttonUrl?: string; image?: string }
  | undefined;

type HomeThemeRenderProps = {
  themeId: HomeThemeId;
  courses: CourseWithRelations[];
  categories: { id: string; nameEn: string; nameAr?: string | null; slug: string; _count?: { courses: number } }[];
  instructors: { id: string; name: string; bio: string | null }[];
  reviews: { id: string; rating: number; comment: string | null; user: { name: string } | null; course: { title: string } | null }[];
  slide: SliderLike;
  settings: SiteSettings;
};

// ---------------------------------------------------------------------------
// Shared style objects — frosted glass surface (stronger blur, more
// transparency, pastel-toned shadow).
// ---------------------------------------------------------------------------

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.55)',
  borderRadius: '28px',
  boxShadow: 'var(--home-shadow)',
};

const glassCardSoft: React.CSSProperties = {
  background: 'rgba(255,255,255,0.35)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: '28px',
};

// Signature pastel multi-color gradient — pink → lavender → blue → yellow.
// Hardcoded stops are part of the theme's defining visual identity.
const pastelGradient =
  'linear-gradient(135deg, #FCE7F3 0%, #E9D5FF 30%, #DBEAFE 65%, #FEF3C7 100%)';

const pinkGlow = '0 12px 40px rgba(236, 72, 153, 0.18)';
const pinkGlowStrong = '0 20px 60px rgba(236, 72, 153, 0.30)';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlassPastelTheme({
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

  const featuredCourses = courses.slice(0, 6);
  const programCourses = courses.slice(0, 3);
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
      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 1. PASTEL GRADIENT HERO — asymmetric layout with floating glass    */}
      {/*    cards, soft gradient background, decorative translucent blobs   */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: pastelGradient,
          minHeight: '88vh',
          fontFamily: 'var(--home-font-family)',
        }}
        aria-labelledby="glass-pastel-hero-heading"
      >
        {/* Layered translucent decorative shapes (blobs) — purely decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 520,
            height: 520,
            top: '-140px',
            insetInlineStart: '-120px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(244, 114, 182, 0.55) 0%, rgba(244, 114, 182, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 460,
            height: 460,
            top: '20%',
            insetInlineEnd: '-100px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(147, 197, 253, 0.55) 0%, rgba(147, 197, 253, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 400,
            height: 400,
            bottom: '-120px',
            insetInlineStart: '35%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.45) 0%, rgba(253, 224, 71, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 360,
            height: 360,
            top: '55%',
            insetInlineStart: '8%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(196, 181, 253, 0.50) 0%, rgba(196, 181, 253, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Additional small decorative blob for asymmetry */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 240,
            height: 240,
            top: '10%',
            insetInlineEnd: '20%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(236, 72, 153, 0.30) 0%, rgba(236, 72, 153, 0) 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Asymmetric grid: text leading (0.9fr), floating glass cards trailing (1.1fr) */}
        <div
          className="relative mx-auto grid max-w-[1280px] items-center gap-8 px-6 py-16 md:gap-12 md:px-8 lg:min-h-[88vh] lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-28"
        >
          {/* Leading: text content */}
          <div className="text-start">
            {/* Eyebrow pill — floating glass */}
            <span
              className="mb-6 inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold uppercase tracking-widest"
              style={{
                ...glassCard,
                borderRadius: '9999px',
                color: 'var(--home-accent)',
                boxShadow: pinkGlow,
              }}
            >
              <Sparkles size={13} strokeWidth={2} />
              {copy.recommendedTitle || ui.home.counters[0]}
            </span>

            {/* Headline — Onest 500 weight, rounded proportions, responsive sizing */}
            <h1
              id="glass-pastel-hero-heading"
              className="max-w-4xl text-[28px] font-medium leading-[1.1] tracking-tight sm:text-[36px] md:text-[48px] lg:text-[64px] xl:text-[78px]"
              style={{
                color: 'var(--home-text)',
                fontFamily: 'var(--home-font-display)',
                fontWeight: 500,
              }}
            >
              {copy.heroTitle || slide?.title}
            </h1>

            {/* Subtitle */}
            <p
              className="mt-6 max-w-xl text-base leading-7 md:text-lg md:leading-8 lg:text-xl"
              style={{ color: 'var(--home-muted)' }}
            >
              {copy.heroSubtitle || slide?.subtitle}
            </p>

            {/* Soft rounded glass search bar */}
            <form
              className="mt-8 flex w-full max-w-xl overflow-hidden md:mt-10"
              style={{
                ...glassCard,
                borderRadius: '9999px',
                boxShadow: pinkGlow,
              }}
              action="/courses"
            >
              <div
                className="grid w-14 shrink-0 place-items-center"
                style={{ color: 'var(--home-muted)' }}
              >
                <Search size={18} strokeWidth={1.8} />
              </div>
              <input
                className={`min-w-0 flex-1 bg-transparent py-4 text-sm font-medium outline-none placeholder:opacity-70 ${focusRingClasses('glass-pastel')}`}
                style={{ color: 'var(--home-text)' }}
                name="q"
                placeholder={copy.searchPlaceholder || ui.common.search}
              />
              <button
                type="submit"
                className={`m-1.5 hidden min-h-[44px] min-w-[44px] shrink-0 items-center gap-2 px-6 text-sm font-semibold sm:inline-flex ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                style={{
                  background: 'var(--home-accent)',
                  color: 'var(--home-button-text)',
                  borderRadius: '9999px',
                }}
              >
                {copy.primaryCtaLabel || ui.common.search}
                <ArrowRight size={15} strokeWidth={2.2} className={isRtl ? 'rtl:rotate-180' : ''} />
              </button>
            </form>

            {/* CTA buttons — primary solid pink, secondary glass */}
            <div
              className="mt-8 flex flex-col gap-4 sm:flex-row"
            >
              <Link
                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 px-10 text-base font-semibold ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                style={{
                  background: 'var(--home-accent)',
                  color: 'var(--home-button-text)',
                  borderRadius: '9999px',
                  boxShadow: pinkGlowStrong,
                }}
                href={copy.primaryCtaUrl || slide?.buttonUrl || '/courses'}
              >
                {copy.primaryCtaLabel || slide?.buttonText || ui.common.browseCatalog}
                <ArrowRight size={18} strokeWidth={2.2} className={isRtl ? 'rtl:rotate-180' : ''} />
              </Link>
              {settings.registrationEnabled && (
                <Link
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 px-10 text-base font-semibold ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                  style={{
                    ...glassCard,
                    color: 'var(--home-text)',
                    borderRadius: '9999px',
                    boxShadow: pinkGlow,
                  }}
                  href={copy.secondaryCtaUrl || '/instructors'}
                >
                  {copy.secondaryCtaLabel || ui.dashboard.roleLabels.instructor}
                </Link>
              )}
            </div>

            {/* Soft counter chips — generous padding, rounded */}
            <div
              className="mt-10 flex flex-wrap gap-4 md:mt-14"
            >
              {[
                { value: courses.length, label: copy.counterCoursesLabel || ui.home.counters[0], Icon: BookOpen },
                { value: categories.length, label: copy.counterCategoriesLabel || ui.home.counters[1], Icon: Sparkles },
                { value: instructors.length, label: copy.counterInstructorsLabel || ui.home.counters[2], Icon: Heart },
              ].map(({ value, label, Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-5 py-3 md:px-6"
                  style={{
                    ...glassCardSoft,
                    borderRadius: '9999px',
                  }}
                >
                  <Icon size={16} strokeWidth={1.8} style={{ color: 'var(--home-accent)' }} />
                  <span
                    className="text-base font-medium"
                    style={{ color: 'var(--home-text)', fontFamily: 'var(--home-font-display)', fontWeight: 500 }}
                  >
                    {value}+
                  </span>
                  <span
                    className="text-xs font-medium uppercase tracking-widest"
                    style={{ color: 'var(--home-muted)' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trailing: floating glass card elements (asymmetric composition) */}
          <div className="hidden lg:block" aria-hidden="true">
            <div className="relative min-h-[560px]">
              {/* Main tilted glass card with course image */}
              <div
                className="absolute inset-inline-start-8 inset-inline-end-8 top-6 h-[420px] overflow-hidden rounded-[42px]"
                style={{ ...glassCard, transform: 'rotate(5deg)' }}
              >
                {featuredCourses[0]?.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featuredCourses[0].coverImage} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="grid h-full place-items-center text-[var(--home-accent)]">
                    <BookOpen size={56} />
                  </div>
                )}
              </div>
              {/* Floating info glass card — bottom leading */}
              <div
                className="absolute bottom-10 inset-inline-start-0 w-[58%] rounded-[34px] p-6"
                style={{ ...glassCard, boxShadow: pinkGlowStrong }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--home-accent)' }}
                >
                  {copy.liveBadgeLabel || copy.recommendedTitle}
                </p>
                <p
                  className="mt-3 line-clamp-2 text-2xl font-medium leading-tight"
                  style={{ color: 'var(--home-text)', fontFamily: 'var(--home-font-display)', fontWeight: 500 }}
                >
                  {featuredCourses[0]?.title || copy.featuredTitle}
                </p>
                <p
                  className="mt-3 line-clamp-2 text-sm leading-6"
                  style={{ color: 'var(--home-muted)' }}
                >
                  {featuredCourses[0]?.shortDescription || copy.featuredSubtitle}
                </p>
              </div>
              {/* Floating mini-list glass card — bottom trailing */}
              <div
                className="absolute bottom-0 inset-inline-end-0 grid w-[42%] gap-3 rounded-[30px] p-4"
                style={glassCardSoft}
              >
                {featuredCourses.slice(1, 4).map((course) => (
                  <div key={course.id} className="flex items-center gap-3 rounded-2xl bg-white/40 p-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 text-[var(--home-accent)]">
                      <Heart size={16} />
                    </div>
                    <p
                      className="line-clamp-2 text-sm font-medium leading-5"
                      style={{ color: 'var(--home-text)', fontWeight: 500 }}
                    >
                      {course.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 2. FLOATING GLASS CARDS ROW — featured courses                     */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20"
        style={{
          background: 'var(--home-bg)',
          fontFamily: 'var(--home-font-family)',
          paddingBlock: '80px',
        }}
        aria-label="Featured courses"
        data-scroll-animate
      >
        {/* Soft decorative blob behind the grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 500,
            height: 500,
            top: '20%',
            insetInlineEnd: '-150px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(236, 72, 153, 0.18) 0%, rgba(236, 72, 153, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Additional floating blob for section transition */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 380,
            height: 380,
            bottom: '-80px',
            insetInlineStart: '10%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(196, 181, 253, 0.30) 0%, rgba(196, 181, 253, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="page-shell relative">
          <div
            className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            data-animate
          >
            <div className="text-start">
              <h2
                className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl"
                style={{
                  color: 'var(--home-text)',
                  fontFamily: 'var(--home-font-display)',
                }}
              >
                {copy.featuredTitle}
              </h2>
              <p
                className="mt-3 max-w-2xl text-base leading-7"
                style={{ color: 'var(--home-muted)' }}
              >
                {copy.featuredSubtitle}
              </p>
            </div>
            <Link
              className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-2 px-6 py-3 text-sm font-semibold ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
              style={{
                ...glassCard,
                borderRadius: '9999px',
                color: 'var(--home-text)',
                boxShadow: pinkGlow,
              }}
              href="/courses"
            >
              {copy.browseAllLabel || ui.common.browseCatalog}
              <ArrowRight size={15} strokeWidth={2.2} className={isRtl ? 'rtl:rotate-180' : ''} aria-hidden="true" />
            </Link>
          </div>

          {/* Floating glass cards grid */}
          <div className="mt-12 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.length ? (
              featuredCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  data-animate
                  className={`group flex flex-col overflow-hidden ${cardHoverClasses('glass-pastel')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                  style={{
                    ...glassCard,
                    boxShadow: pinkGlow,
                  }}
                >
                  {/* Cover image with rounded inner mask */}
                  <div
                    className="aspect-[4/3] overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.30)', borderRadius: '28px 28px 0 0' }}
                  >
                    {course.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.coverImage}
                        alt=""
                        aria-hidden="true"
                        className={`h-full w-full object-cover transition duration-500 group-hover:scale-110 ${REDUCED_MOTION_OVERRIDE}`}
                      />
                    ) : (
                      <div
                        className="grid h-full place-items-center"
                        style={{ color: 'var(--home-accent)' }}
                        aria-hidden="true"
                      >
                        <BookOpen size={42} strokeWidth={1.4} />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-6">
                    <p
                      className="text-xs font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--home-accent)' }}
                    >
                      {course.category
                        ? categoryLabel(course.category)
                        : copy.courseSingularLabel || ui.common.course}
                    </p>
                    <h3
                      className="mt-2 line-clamp-2 min-h-[3rem] text-lg font-bold leading-snug"
                      style={{
                        color: 'var(--home-text)',
                        fontFamily: 'var(--home-font-display)',
                        fontWeight: 500,
                      }}
                    >
                      {course.title}
                    </h3>
                    {course.instructor && (
                      <p
                        className="mt-1 text-sm font-medium"
                        style={{ color: 'var(--home-muted)' }}
                      >
                        {course.instructor.name}
                      </p>
                    )}
                    {course.shortDescription && (
                      <p
                        className="mt-2 line-clamp-2 flex-1 text-sm leading-6"
                        style={{ color: 'var(--home-muted)' }}
                      >
                        {course.shortDescription}
                      </p>
                    )}

                    <div
                      className={`mt-5 flex items-center justify-between gap-3 border-t pt-4 text-sm ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                      style={{ borderColor: 'rgba(255,255,255,0.55)' }}
                    >
                      <span
                        className="inline-flex items-center gap-1.5 font-medium"
                        style={{ color: 'var(--home-muted)' }}
                      >
                        <Heart size={13} strokeWidth={1.8} aria-hidden="true" />
                        {course.enrollments?.length ?? 0}
                      </span>
                      <span
                        className="text-base font-bold"
                        style={{ color: 'var(--home-accent)' }}
                      >
                        {course.isFree
                          ? copy.freeLabel || ui.courseCard.free
                          : formatMoney(course.salePrice ?? course.price, settings.currency)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p
                className="col-span-full py-12 text-center text-sm"
                style={{ color: 'var(--home-muted)' }}
              >
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 3. SOFT PILL RAIL — categories as floating glass pills              */}
      {/* ────────────────────────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <section
          className="py-10"
          style={{
            background: 'linear-gradient(180deg, var(--home-bg) 0%, rgba(252, 231, 243, 0.25) 100%)',
            fontFamily: 'var(--home-font-family)',
          }}
          aria-label="Categories"
          data-scroll-animate
        >
          <div className="page-shell">
            <div
              className={`mb-6 flex flex-col gap-2 ${isRtl ? 'rtl:items-end' : ''}`}
              data-animate
            >
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--home-accent)' }}
              >
                {copy.recommendedTitle || ui.home.counters[1]}
              </span>
              <h2
                className="text-2xl font-bold sm:text-3xl"
                style={{
                  color: 'var(--home-text)',
                  fontFamily: 'var(--home-font-display)',
                }}
              >
                {copy.recommendedSubtitle || copy.recommendedTitle}
              </h2>
            </div>

            <div
              className={`scrollbar-none flex flex-wrap gap-3 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
              data-animate
            >
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className={`inline-flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-semibold ${cardHoverClasses('glass-pastel')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                  style={{
                    ...glassCardSoft,
                    borderRadius: '9999px',
                    color: 'var(--home-text)',
                    boxShadow: '0 4px 16px rgba(236, 72, 153, 0.10)',
                  }}
                >
                  <Sparkles
                    size={13}
                    strokeWidth={1.8}
                    style={{ color: 'var(--home-accent)' }}
                    aria-hidden="true"
                  />
                  {categoryLabel(category)}
                  {category._count?.courses !== undefined && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--home-muted)' }}
                    >
                      ({category._count.courses})
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 4. GLASS PROGRAM PANELS — larger glass surfaces with sparkle/heart  */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20"
        style={{
          background:
            'linear-gradient(180deg, var(--home-bg) 0%, rgba(233, 213, 255, 0.45) 100%)',
          fontFamily: 'var(--home-font-family)',
          paddingBlock: '80px',
        }}
        aria-label="Programs"
        data-scroll-animate
      >
        {/* Decorative blob */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 480,
            height: 480,
            top: '10%',
            insetInlineStart: '-140px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(196, 181, 253, 0.45) 0%, rgba(196, 181, 253, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Additional floating blob for visual depth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 340,
            height: 340,
            bottom: '5%',
            insetInlineEnd: '-60px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.25) 0%, rgba(253, 224, 71, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="page-shell relative">
          <div className="mb-12 text-start" data-animate>
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--home-accent)' }}
            >
              <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
              {copy.panelTitle}
            </span>
            <h2
              className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl"
              style={{
                background:
                  'linear-gradient(90deg, var(--home-accent) 0%, #A855F7 50%, #60A5FA 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
                fontFamily: 'var(--home-font-display)',
              }}
            >
              {copy.panelSubtitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programCourses.length ? (
              programCourses.map((course, idx) => {
                const Icon = idx % 2 === 0 ? Sparkles : Heart;
                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.slug}`}
                    data-animate
                    className={`group flex flex-col overflow-hidden p-7 ${cardHoverClasses('glass-pastel')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                    style={{
                      ...glassCard,
                      boxShadow: pinkGlow,
                    }}
                  >
                    <div
                      className="grid h-12 w-12 place-items-center"
                      style={{
                        background: 'rgba(236, 72, 153, 0.15)',
                        borderRadius: '16px',
                        color: 'var(--home-accent)',
                      }}
                      aria-hidden="true"
                    >
                      <Icon size={20} strokeWidth={1.8} />
                    </div>

                    <p
                      className="mt-5 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--home-accent)' }}
                    >
                      {course.category
                        ? categoryLabel(course.category)
                        : copy.courseSingularLabel || ui.common.course}
                    </p>

                    <h3
                      className="mt-2 text-xl font-bold leading-snug"
                      style={{
                        color: 'var(--home-text)',
                        fontFamily: 'var(--home-font-display)',
                        fontWeight: 500,
                      }}
                    >
                      {course.title}
                    </h3>

                    {course.instructor && (
                      <p
                        className="mt-1 text-sm font-medium"
                        style={{ color: 'var(--home-muted)' }}
                      >
                        {course.instructor.name}
                      </p>
                    )}

                    {course.shortDescription && (
                      <p
                        className="mt-3 line-clamp-3 flex-1 text-sm leading-6"
                        style={{ color: 'var(--home-muted)' }}
                      >
                        {course.shortDescription}
                      </p>
                    )}

                    <div
                      className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                      style={{ color: 'var(--home-accent)' }}
                    >
                      {copy.viewProgramLabel || ui.common.openCourse || ui.common.browseCatalog}
                      <ArrowRight
                        size={15}
                        strokeWidth={2.2}
                        className={`transition group-hover:translate-x-1 ${REDUCED_MOTION_OVERRIDE} ${isRtl ? 'rtl:rotate-180 rtl:group-hover:-translate-x-1' : ''}`}
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                );
              })
            ) : (
              <p
                className="col-span-full py-10 text-center text-sm"
                style={{ color: 'var(--home-muted)' }}
              >
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 5. FLOATING REVIEWS / STORIES — testimonial glass cards            */}
      {/*    with subtle vertical offset to feel "floating"                   */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20"
        style={{
          background:
            'linear-gradient(180deg, rgba(233, 213, 255, 0.45) 0%, var(--home-bg) 100%)',
          fontFamily: 'var(--home-font-family)',
          paddingBlock: '80px',
        }}
        aria-label="Testimonials"
        data-scroll-animate
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 460,
            height: 460,
            top: '0%',
            insetInlineEnd: '-100px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(147, 197, 253, 0.40) 0%, rgba(147, 197, 253, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Additional floating blob for section depth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 300,
            height: 300,
            bottom: '10%',
            insetInlineStart: '5%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(244, 114, 182, 0.25) 0%, rgba(244, 114, 182, 0) 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="page-shell relative">
          <div className="mb-14 text-center" data-animate>
            <h2
              className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl"
              style={{
                color: 'var(--home-text)',
                fontFamily: 'var(--home-font-display)',
              }}
            >
              {copy.storiesTitle}
            </h2>
            <p
              className="mx-auto mt-3 max-w-2xl text-base leading-7"
              style={{ color: 'var(--home-muted)' }}
            >
              {copy.storiesBody}
            </p>
          </div>

          {/* Floating offset grid */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {reviewCards.length ? (
              reviewCards.map((review, idx) => {
                // Subtle vertical offset per column to create a "floating"
                // layout. Center column sits slightly higher; outer columns
                // shift down. Disabled below md.
                const offsetClass =
                  idx === 0
                    ? 'md:translate-y-6'
                    : idx === 1
                      ? 'md:-translate-y-2'
                      : 'md:translate-y-10';

                return (
                  <article
                    key={review.id}
                    data-animate
                    className={`flex flex-col p-7 ${cardHoverClasses('glass-pastel')} ${REDUCED_MOTION_OVERRIDE} ${offsetClass}`}
                    style={{
                      ...glassCard,
                      boxShadow: pinkGlow,
                    }}
                  >
                    <Quote
                      size={26}
                      strokeWidth={1.5}
                      style={{ color: 'var(--home-accent)' }}
                      aria-hidden="true"
                    />
                    <p
                      className="mt-5 flex-1 text-base leading-7"
                      style={{ color: 'var(--home-text)' }}
                    >
                      {review.comment || copy.storiesBody}
                    </p>
                    <footer
                      className={`mt-6 flex items-center justify-between gap-3 border-t pt-5 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                      style={{ borderColor: 'rgba(255,255,255,0.55)' }}
                    >
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--home-text)' }}
                      >
                        {review.user?.name ||
                          copy.approvedInstructorLabel ||
                          ui.home.approvedInstructor}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-sm font-bold"
                        style={{ color: 'var(--home-accent)' }}
                      >
                        <Star size={13} fill="currentColor" aria-hidden="true" />
                        {review.rating}/5
                      </span>
                    </footer>
                  </article>
                );
              })
            ) : (
              <p
                className="col-span-full py-10 text-center text-sm"
                style={{ color: 'var(--home-muted)' }}
              >
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 6. GRADIENT CTA CLOUD — large rounded gradient panel + inner glass  */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <section
        className="py-24"
        style={{
          background: 'var(--home-bg)',
          fontFamily: 'var(--home-font-family)',
          paddingBlock: '80px',
        }}
        aria-label="Call to action"
        data-scroll-animate
      >
        <div className="page-shell">
          <div
            className="relative mx-auto max-w-5xl overflow-hidden p-2"
            style={{
              background: pastelGradient,
              borderRadius: '40px',
              boxShadow: '0 30px 80px rgba(236, 72, 153, 0.25)',
            }}
            data-animate
          >
            {/* Cloud blobs inside the gradient panel */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                width: 320,
                height: 320,
                top: '-100px',
                insetInlineStart: '-80px',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(244, 114, 182, 0.55) 0%, rgba(244, 114, 182, 0) 70%)',
                filter: 'blur(80px)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                width: 320,
                height: 320,
                bottom: '-100px',
                insetInlineEnd: '-80px',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(147, 197, 253, 0.50) 0%, rgba(147, 197, 253, 0) 70%)',
                filter: 'blur(80px)',
              }}
            />

            {/* Inner glass card */}
            <div
              className="relative px-6 py-14 text-center sm:px-12 sm:py-16 lg:px-16 lg:py-20"
              style={{
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.55)',
                borderRadius: '36px',
              }}
            >
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest"
                style={{
                  background: 'rgba(236, 72, 153, 0.18)',
                  color: 'var(--home-accent)',
                  borderRadius: '9999px',
                }}
              >
                <Heart size={12} strokeWidth={2.2} aria-hidden="true" />
                {copy.recommendedTitle || ui.home.counters[0]}
              </span>

              <h2
                className="mx-auto mt-6 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl"
                style={{
                  color: 'var(--home-text)',
                  fontFamily: 'var(--home-font-display)',
                }}
              >
                {copy.finalTitle}
              </h2>

              <p
                className="mx-auto mt-5 max-w-2xl text-lg leading-8"
                style={{ color: 'var(--home-muted)' }}
              >
                {copy.finalBody}
              </p>

              <div
                className={`mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
              >
                <Link
                  href={copy.primaryCtaUrl || '/courses'}
                  className={`inline-flex min-h-[56px] min-w-[44px] items-center gap-2 px-10 text-base font-semibold ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                  style={{
                    background: 'var(--home-accent)',
                    color: 'var(--home-button-text)',
                    borderRadius: '9999px',
                    boxShadow: pinkGlowStrong,
                  }}
                >
                  {copy.primaryCtaLabel || copy.browseCatalogLabel || ui.common.browseCatalog}
                  <ArrowRight
                    size={18}
                    strokeWidth={2.2}
                    className={isRtl ? 'rtl:rotate-180' : ''}
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/partners"
                  className={`inline-flex min-h-[56px] min-w-[44px] items-center gap-2 px-10 text-base font-semibold ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('glass-pastel')}`}
                  style={{
                    ...glassCardSoft,
                    color: 'var(--home-text)',
                    borderRadius: '9999px',
                    boxShadow: pinkGlow,
                  }}
                >
                  {copy.businessCtaLabel}
                  <ArrowRight
                    size={16}
                    strokeWidth={2.2}
                    className={isRtl ? 'rtl:rotate-180' : ''}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
