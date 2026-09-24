import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Quote,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react';
import { localizedCopy } from '@/lib/localized-copy';
import { formatMoney, type SiteSettings } from '@/lib/site-settings';
import type { HomeThemeId } from '@/lib/home-theme-registry';
import { focusRingClasses } from '@/lib/focus-ring';
import { cardHoverClasses, ctaHoverClasses, REDUCED_MOTION_OVERRIDE } from '@/lib/animation-classes';

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

// Shared glass card style — frosted glass effect
const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '20px',
};

export function BoldVibrantTheme({
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

  const featuredCourses = courses.slice(0, 9);
  const programCourses = courses.slice(0, 3);
  const reviewCards = reviews.length
    ? reviews.slice(0, 3)
    : courses
        .flatMap((c) => c.reviews.map((r) => ({ ...r, user: null, course: { title: c.title } })))
        .slice(0, 3);

  // Gradient accent bar colors for course cards (cycles through 3 variants)
  const accentBars = [
    'linear-gradient(90deg, var(--home-accent), var(--home-accent-strong))',
    'linear-gradient(90deg, var(--home-accent-strong), var(--home-accent-soft))',
    'linear-gradient(90deg, var(--home-accent-soft), var(--home-accent))',
  ];

  return (
    <>
      {/* ── Hero — Asymmetric poster layout with angled decorative elements ── */}
      <section
        className="relative min-h-screen overflow-hidden"
        style={{ background: 'var(--home-bg)' }}
        aria-labelledby="bold-vibrant-hero-heading"
      >
        {/* Angled decorative element — top-right diagonal slice */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            clipPath: 'polygon(60% 0, 100% 0, 100% 70%, 40% 100%)',
            background: 'linear-gradient(135deg, var(--home-accent-soft), var(--home-accent-strong))',
            opacity: 0.12,
          }}
        />

        {/* Angled decorative element — bottom-left accent stripe */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            insetBlockEnd: 0,
            insetInlineStart: 0,
            width: '40%',
            height: '30%',
            clipPath: 'polygon(0 40%, 100% 0, 100% 100%, 0 100%)',
            background: 'var(--home-accent)',
            opacity: 0.08,
          }}
        />

        {/* Radial glow behind headline area */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 600,
            height: 600,
            top: '-80px',
            insetInlineStart: '-60px',
            borderRadius: '50%',
            background: 'var(--home-accent-soft)',
            filter: 'blur(100px)',
            opacity: 0.35,
          }}
        />

        {/* Secondary glow — trailing side */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: 500,
            height: 500,
            top: '25%',
            insetInlineEnd: '-80px',
            borderRadius: '50%',
            background: 'var(--home-accent)',
            filter: 'blur(90px)',
            opacity: 0.15,
          }}
        />

        {/* Subtle mesh overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,255,255,0.06), transparent)',
          }}
        />

        {/* Asymmetric poster grid: text-heavy leading side, visual trailing side */}
        <div
          className="page-shell relative grid min-h-screen max-w-[1280px] items-center gap-8 py-20 md:gap-12 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:py-28"
          style={{ marginInline: 'auto' }}
        >
          {/* Leading content column */}
          <div style={{ textAlign: isRtl ? 'end' : 'start' }}>
            {/* Eyebrow badge */}
            <span
              className="mb-6 inline-flex items-center gap-2 px-5 py-2 text-xs font-black uppercase tracking-widest"
              style={{
                ...glassCard,
                color: 'var(--home-accent)',
                border: '1px solid var(--home-accent)',
                borderRadius: '9999px',
              }}
            >
              <Zap size={13} strokeWidth={2.5} />
              {copy.recommendedTitle || ui.home.counters[0]}
            </span>

            {/* Oversized display headline — 48px+ desktop (Poppins 700+) */}
            <h1
              id="bold-vibrant-hero-heading"
              className="max-w-4xl text-[28px] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[36px] md:text-[48px] lg:text-[64px] xl:text-[80px]"
              style={{
                color: 'var(--home-text)',
                fontFamily: 'var(--home-font-display)',
                fontWeight: 800,
              }}
            >
              {copy.heroTitle || slide?.title}
            </h1>

            <p
              className="mt-6 max-w-xl text-base leading-7 md:mt-8 md:text-lg md:leading-8 lg:text-xl"
              style={{ color: 'var(--home-muted)' }}
            >
              {copy.heroSubtitle || slide?.subtitle}
            </p>

            {/* Prominent CTA buttons — 44px+ touch targets */}
            <div
              className="mt-8 flex flex-col gap-4 sm:flex-row md:mt-10"
            >
              <Link
                className={`inline-flex min-h-[56px] min-w-[44px] items-center justify-center gap-2 px-10 text-base font-black ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
                style={{
                  background: 'var(--home-accent)',
                  color: 'var(--home-button-text)',
                  borderRadius: '9999px',
                  boxShadow: '0 0 32px rgba(245,158,11,0.45)',
                }}
                href={copy.primaryCtaUrl || slide?.buttonUrl || '/courses'}
              >
                {copy.primaryCtaLabel || slide?.buttonText || ui.common.browseCatalog}
                <ArrowRight size={18} strokeWidth={2.5} className="rtl:-scale-x-100" aria-hidden="true" />
              </Link>
              {settings.registrationEnabled && settings.instructorsEnabled && (
                <Link
                  className={`inline-flex min-h-[56px] min-w-[44px] items-center justify-center gap-2 px-10 text-base font-black ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
                  style={{
                    ...glassCard,
                    color: 'var(--home-text)',
                    borderRadius: '9999px',
                  }}
                  href={copy.secondaryCtaUrl || '/register?role=INSTRUCTOR'}
                >
                  {copy.secondaryCtaLabel || ui.dashboard.roleLabels.instructor}
                </Link>
              )}
            </div>

            {/* Glass search bar */}
            <form
              className="mt-8 flex w-full max-w-xl overflow-hidden md:mt-10"
              style={{
                ...glassCard,
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '9999px',
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
                className="min-w-0 flex-1 bg-transparent py-4 text-sm font-semibold outline-none"
                style={{ color: 'var(--home-text)' }}
                name="q"
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder || 'Search courses'}
              />
              <button
                type="submit"
                className={`m-1.5 hidden min-h-[44px] shrink-0 items-center gap-2 px-6 text-sm font-black sm:inline-flex ${focusRingClasses('bold-vibrant')}`}
                style={{
                  background: 'var(--home-accent)',
                  color: 'var(--home-button-text)',
                  borderRadius: '9999px',
                }}
              >
                {copy.primaryCtaLabel || ui.common.search}
                <ArrowRight size={15} strokeWidth={2.5} className="rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* Trailing visual column — angled card mosaic (desktop only) */}
          <div className="relative hidden min-h-[520px] lg:block" aria-hidden="true">
            {/* Angled background card — rotated for poster effect */}
            <div
              className="absolute inset-0 rotate-[-6deg] rounded-[36px]"
              style={{
                background: 'linear-gradient(135deg, var(--home-accent), var(--home-accent-strong))',
                boxShadow: '0 28px 90px rgba(0,0,0,0.36)',
              }}
            />
            {/* Inner glass panel with course previews */}
            <div
              className="absolute inset-8 rotate-[3deg] overflow-hidden rounded-[30px]"
              style={{ ...glassCard, background: 'rgba(255,255,255,0.11)' }}
            >
              <div className="grid h-full grid-rows-[1fr_auto]">
                <div className="grid grid-cols-2 gap-4 p-5">
                  {featuredCourses.slice(0, 4).map((course, idx) => (
                    <div
                      key={course.id}
                      className={`overflow-hidden rounded-3xl border border-white/15 bg-black/20 ${idx === 0 ? 'col-span-2' : ''}`}
                    >
                      {course.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={course.coverImage} alt="" aria-hidden="true" className="h-full min-h-40 w-full object-cover opacity-90" />
                      ) : (
                        <div className="grid h-full min-h-40 place-items-center text-[var(--home-accent)]">
                          <BookOpen size={42} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/15 p-6">
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--home-accent)]">
                    {copy.liveBadgeLabel || 'Live'}
                  </p>
                  <p className="mt-2 text-3xl font-black leading-none text-[var(--home-text)]">
                    {copy.featuredTitle}
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[
                      { value: courses.length, label: copy.counterCoursesLabel || ui.home.counters[0] },
                      { value: categories.length, label: copy.counterCategoriesLabel || ui.home.counters[1] },
                      { value: instructors.length, label: copy.counterInstructorsLabel || ui.home.counters[2] },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-white/10 p-3">
                        <p className="text-2xl font-black text-white">{item.value}+</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--home-muted)]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stat counters row — spans full width below the grid */}
          <div
            className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:col-span-2"
          >
            {[
              { value: courses.length, label: copy.counterCoursesLabel || ui.home.counters[0], icon: BookOpen },
              { value: categories.length, label: copy.counterCategoriesLabel || ui.home.counters[1], icon: Sparkles },
              { value: instructors.length, label: copy.counterInstructorsLabel || ui.home.counters[2], icon: GraduationCap },
            ].map(({ value, label, icon: Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 px-6 py-4 sm:px-8 sm:py-5"
                style={{ ...glassCard, minWidth: 120 }}
              >
                <Icon size={20} strokeWidth={1.8} style={{ color: 'var(--home-accent)' }} />
                <p
                  className="text-3xl font-black leading-none sm:text-4xl"
                  style={{ color: 'var(--home-text)', fontFamily: 'var(--home-font-display)' }}
                >
                  {value}+
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest sm:text-xs" style={{ color: 'var(--home-muted)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category Scroll Rail — glass pill style ───────────────────────── */}
      <section
        className="py-6"
        style={{ background: 'var(--home-bg)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        aria-label="Course categories"
      >
        <div className="page-shell">
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className={`inline-flex h-11 shrink-0 items-center gap-2 px-5 text-sm font-bold transition hover:opacity-80 ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
                style={{
                  ...glassCard,
                  color: 'var(--home-text)',
                  borderRadius: '9999px',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                <Sparkles size={13} strokeWidth={1.8} style={{ color: 'var(--home-accent)' }} aria-hidden="true" />
                {categoryLabel(category)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Angled gradient divider — hero to featured courses ─────────── */}
      <div
        aria-hidden="true"
        className="relative h-16 md:h-24"
        style={{ background: 'var(--home-bg)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(175deg, var(--home-accent-soft) 0%, transparent 60%)',
            clipPath: 'polygon(0 0, 100% 0, 100% 40%, 0 100%)',
            opacity: 0.18,
          }}
        />
      </div>

      {/* ── Featured Courses Grid — 20px radius, gradient overlays, bold badges ── */}
      <section
        className="py-20"
        style={{ background: 'var(--home-bg)', paddingBlock: '80px' }}
        aria-label="Featured courses"
        data-scroll-animate
      >
        <div className="page-shell">
          <div
            className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            data-animate
          >
            <div className="text-start">
              <h2
                className="text-4xl font-black leading-tight lg:text-5xl"
                style={{ color: 'var(--home-text)', fontFamily: 'var(--home-font-display)' }}
              >
                {copy.featuredTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-base" style={{ color: 'var(--home-muted)' }}>
                {copy.featuredSubtitle}
              </p>
            </div>
            <Link
              className={`inline-flex shrink-0 items-center gap-2 px-6 py-3 text-sm font-black transition hover:opacity-80 ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
              style={{
                ...glassCard,
                color: 'var(--home-text)',
                borderRadius: '9999px',
              }}
              href="/courses"
            >
              {copy.browseAllLabel || ui.common.browseCatalog}
              <ArrowRight size={15} strokeWidth={2.5} className="rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </div>

          {/* 3-column glass card grid */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {featuredCourses.length ? (
              featuredCourses.map((course, idx) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  data-animate
                  className={`group overflow-hidden rounded-[20px] ${cardHoverClasses('bold-vibrant')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
                  style={{
                    ...glassCard,
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                  }}
                >
                  {/* Colored gradient accent bar at top */}
                  <div
                    className="h-1.5 w-full"
                    aria-hidden="true"
                    style={{ background: accentBars[idx % 3] }}
                  />

                  {/* Oversized thumbnail with gradient overlay — aspect-ratio 4/3 */}
                  <div
                    className="relative aspect-[4/3] overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    {course.coverImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={course.coverImage}
                          alt=""
                          aria-hidden="true"
                          className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${REDUCED_MOTION_OVERRIDE}`}
                        />
                        {/* Gradient thumbnail overlay */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: 'linear-gradient(180deg, transparent 40%, rgba(76,29,149,0.55) 100%)',
                          }}
                        />
                      </>
                    ) : (
                      <div
                        className="grid h-full place-items-center"
                        style={{ color: 'var(--home-accent)' }}
                      >
                        <BookOpen size={44} strokeWidth={1.3} aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <p
                      className="text-xs font-black uppercase tracking-widest"
                      style={{ color: 'var(--home-accent)' }}
                    >
                      {course.category
                        ? categoryLabel(course.category)
                        : copy.courseSingularLabel || ui.common.course}
                    </p>
                    <h3
                      className="mt-2 line-clamp-2 min-h-[3rem] text-base font-black leading-snug"
                      style={{ color: 'var(--home-text)' }}
                    >
                      {course.title}
                    </h3>
                    <p
                      className="mt-2 line-clamp-2 text-sm leading-6"
                      style={{ color: 'var(--home-muted)' }}
                    >
                      {course.shortDescription}
                    </p>

                    {/* Footer row with bold price badge */}
                    <div
                      className={`mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ color: 'var(--home-muted)' }}
                      >
                        <UsersRound size={14} aria-hidden="true" />
                        {course.enrollments?.length || 0}
                      </span>
                      {/* Bold price badge — pill-shaped */}
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black"
                        style={{
                          background: 'var(--home-accent)',
                          color: 'var(--home-button-text)',
                        }}
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

      {/* ── Angled gradient divider — featured to programs ──────────────── */}
      <div
        aria-hidden="true"
        className="relative h-16 md:h-24"
        style={{ background: '#FFFFFF' }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(185deg, var(--home-bg) 0%, transparent 50%)',
            clipPath: 'polygon(0 0, 100% 0, 100% 60%, 0 100%)',
          }}
        />
      </div>

      {/* ── Contrasting Light Panel — Programs / Learning Paths ────────── */}
      <section
        className="py-20"
        style={{
          background: '#FFFFFF',
          color: '#1C1917',
        }}
        aria-label="Programs and learning paths"
        data-scroll-animate
      >
        <div className="page-shell">
          <div
            className={`mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
            data-animate
          >
            <div className="text-start">
              <span
                className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest"
                style={{
                  background: 'var(--home-accent-soft)',
                  color: 'var(--home-accent-strong)',
                  borderRadius: '9999px',
                }}
              >
                <TrendingUp size={12} strokeWidth={2.5} aria-hidden="true" />
                {copy.panelTitle || ui.home.counters[0]}
              </span>
              <h2
                className="mt-4 text-4xl font-black leading-tight lg:text-5xl"
                style={{
                  color: '#1C1917',
                  fontFamily: 'var(--home-font-display)',
                }}
              >
                {copy.panelTitle}
              </h2>
              <p
                className="mt-3 max-w-2xl text-base"
                style={{ color: '#57534E' }}
              >
                {copy.panelSubtitle}
              </p>
            </div>
          </div>

          {/* 3-up program cards on light background */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {programCourses.length ? (
              programCourses.map((course, idx) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  data-animate
                  className={`group flex flex-col overflow-hidden rounded-[20px] border ${cardHoverClasses('bold-vibrant')} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
                  style={{
                    background: '#FAFAFA',
                    borderColor: '#E7E5E4',
                    borderRadius: '20px',
                    boxShadow: '0 4px 16px rgba(76, 29, 149, 0.08)',
                  }}
                >
                  {/* Top accent bar */}
                  <div
                    className="h-1.5 w-full"
                    aria-hidden="true"
                    style={{ background: accentBars[idx % 3] }}
                  />

                  {/* Thumbnail with gradient overlay */}
                  <div
                    className="relative aspect-[16/9] overflow-hidden"
                    style={{ background: '#F5F5F4' }}
                  >
                    {course.coverImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={course.coverImage}
                          alt=""
                          aria-hidden="true"
                          className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${REDUCED_MOTION_OVERRIDE}`}
                        />
                        {/* Gradient thumbnail overlay */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: 'linear-gradient(180deg, transparent 50%, rgba(76,29,149,0.35) 100%)',
                          }}
                        />
                      </>
                    ) : (
                      <div
                        className="grid h-full place-items-center"
                        style={{ color: 'var(--home-accent-strong)' }}
                      >
                        <GraduationCap size={48} strokeWidth={1.3} aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <p
                      className="text-xs font-black uppercase tracking-widest"
                      style={{ color: 'var(--home-accent-strong)' }}
                    >
                      {course.category
                        ? categoryLabel(course.category)
                        : copy.courseSingularLabel || ui.common.course}
                    </p>
                    <h3
                      className="mt-2 line-clamp-2 text-lg font-black leading-snug"
                      style={{
                        color: '#1C1917',
                        fontFamily: 'var(--home-font-display)',
                      }}
                    >
                      {course.title}
                    </h3>
                    {course.shortDescription && (
                      <p
                        className="mt-2 line-clamp-3 flex-1 text-sm leading-6"
                        style={{ color: '#57534E' }}
                      >
                        {course.shortDescription}
                      </p>
                    )}

                    <div
                      className={`mt-5 flex items-center justify-between gap-3 border-t pt-4 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                      style={{ borderColor: '#E7E5E4' }}
                    >
                      <span
                        className="inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: '#57534E' }}
                      >
                        <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden="true" />
                        {course.instructor?.name ||
                          copy.approvedInstructorLabel ||
                          ui.home.approvedInstructor}
                      </span>
                      {/* Bold price badge — pill-shaped */}
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black"
                        style={{
                          background: 'var(--home-accent-strong)',
                          color: '#FFFFFF',
                        }}
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
                className="col-span-full py-10 text-center text-sm"
                style={{ color: '#57534E' }}
              >
                {copy.emptyStateLabel}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Gradient transition — programs to reviews ──────────────────── */}
      <div
        aria-hidden="true"
        className="relative h-16 md:h-24"
        style={{ background: 'var(--home-bg)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(175deg, #FFFFFF 0%, var(--home-bg) 60%)',
          }}
        />
      </div>

      {/* ── Reviews / Stories — back on saturated background, glass cards ── */}
      <section
        className="py-20"
        style={{ background: 'var(--home-bg)' }}
        aria-label="Student reviews"
        data-scroll-animate
      >
        <div className="page-shell">
          <div className="mb-12 text-center" data-animate>
            <h2
              className="text-4xl font-black leading-tight lg:text-5xl"
              style={{
                color: 'var(--home-text)',
                fontFamily: 'var(--home-font-display)',
              }}
            >
              {copy.storiesTitle}
            </h2>
            <p
              className="mx-auto mt-3 max-w-2xl text-base"
              style={{ color: 'var(--home-muted)' }}
            >
              {copy.storiesBody}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {reviewCards.length ? (
              reviewCards.map((review) => (
                <article
                  key={review.id}
                  data-animate
                  className="flex flex-col rounded-[20px] p-7"
                  style={{
                    ...glassCard,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                  }}
                >
                  <Quote
                    size={22}
                    strokeWidth={1.8}
                    style={{ color: 'var(--home-accent)' }}
                    aria-hidden="true"
                  />
                  <p
                    className="mt-4 flex-1 text-base leading-7"
                    style={{ color: 'var(--home-text)' }}
                  >
                    {review.comment || copy.storiesBody}
                  </p>
                  <footer
                    className={`mt-6 flex items-center justify-between gap-3 border-t pt-5 ${isRtl ? 'rtl:flex-row-reverse' : ''}`}
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                  >
                    <span
                      className="text-sm font-bold"
                      style={{ color: 'var(--home-text)' }}
                    >
                      {review.user?.name ||
                        copy.approvedInstructorLabel ||
                        ui.home.approvedInstructor}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-sm font-black"
                      style={{ color: 'var(--home-accent)' }}
                    >
                      <Star size={13} fill="currentColor" aria-hidden="true" />
                      {review.rating}/5
                    </span>
                  </footer>
                </article>
              ))
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

      {/* ── Final Conversion Band — gradient call-to-action ───────────────── */}
      <section
        className="py-24"
        style={{
          background: 'var(--home-bg)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
        aria-label="Call to action"
        data-scroll-animate
      >
        <div className="page-shell">
          <div
            className="mx-auto max-w-4xl rounded-[32px] p-10 text-center sm:p-14"
            data-animate
            style={{
              ...glassCard,
              borderRadius: '32px',
              boxShadow: '0 16px 64px rgba(0,0,0,0.35)',
            }}
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest"
              style={{
                background: 'var(--home-accent-soft)',
                color: 'var(--home-accent)',
                borderRadius: '9999px',
              }}
            >
              <Zap size={12} strokeWidth={2.5} aria-hidden="true" />
              {copy.recommendedTitle || ui.home.counters[0]}
            </span>
            <h2
              className="mt-6 text-4xl font-black leading-tight lg:text-6xl"
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
                className={`inline-flex min-h-[56px] min-w-[44px] items-center gap-2 px-10 text-base font-black ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
                style={{
                  background: 'var(--home-accent)',
                  color: 'var(--home-button-text)',
                  borderRadius: '9999px',
                  boxShadow: '0 0 32px rgba(245,158,11,0.45)',
                }}
              >
                {copy.primaryCtaLabel || copy.browseCatalogLabel || ui.common.browseCatalog}
                <ArrowRight size={18} strokeWidth={2.5} className="rtl:-scale-x-100" aria-hidden="true" />
              </Link>
              <Link
                href="/partners"
                className={`inline-flex min-h-[56px] min-w-[44px] items-center gap-2 px-10 text-base font-black ${ctaHoverClasses()} ${REDUCED_MOTION_OVERRIDE} ${focusRingClasses('bold-vibrant')}`}
                style={{
                  ...glassCard,
                  color: 'var(--home-text)',
                  borderRadius: '9999px',
                }}
              >
                {copy.businessCtaLabel}
                <ArrowRight size={16} strokeWidth={2.5} className="rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
