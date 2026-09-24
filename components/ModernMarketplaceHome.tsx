/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, BarChart3, BookOpen, Clock3, Code2, Play, Search, ShieldCheck, Star, UsersRound } from 'lucide-react';
import { CourseCard } from '@/components/CourseCard';

type ModernMarketplaceHomeProps = {
  courses: any[];
  categories: { id: string; nameEn: string; nameAr?: string | null; slug: string; _count?: { courses: number } }[];
  instructors: { id: string; name: string; bio: string | null }[];
  settings: { defaultLanguage: string; currency: string; rtl?: boolean };
  theme?: Record<string, string>;
  themeId?: string;
  themeLayout?: string;
  style?: CSSProperties;
};

export function ModernMarketplaceHome({ courses, categories, instructors, settings, theme = {}, themeId, themeLayout, style }: ModernMarketplaceHomeProps) {
  const heroTitle = theme.heroTitle || 'Launch a learning marketplace\nthat feels complete.';
  const [heroTitleFirstLine, ...heroTitleRest] = heroTitle.split('\n');
  const heroTitleAccent = heroTitleRest.join(' ').trim();
  const totalFeaturedEnrollments = courses.reduce((sum, course) => sum + (Array.isArray(course.enrollments) ? course.enrollments.length : 0), 0);
  const reviewRatings = courses.flatMap((course) => Array.isArray(course.reviews) ? course.reviews.map((review: { rating: number }) => Number(review.rating || 0)) : []);
  const averageRating = reviewRatings.length ? (reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length).toFixed(1) : '0.0';
  const dynamicPathCards = categories.slice(0, 4).map((category, index) => ({
    title: settings.rtl ? category.nameAr || category.nameEn : category.nameEn,
    courses: `${category._count?.courses || 0} Courses`,
    level: index % 2 === 0 ? 'Beginner' : 'Intermediate',
    icon: [Code2, BookOpen, BarChart3, ArrowRight][index] || BookOpen,
    href: `/categories/${category.slug}`,
  }));

  const stats = [
    { value: String(totalFeaturedEnrollments), label: 'Active learning signals', icon: UsersRound },
    { value: String(courses.length), label: 'Curated course tracks', icon: BookOpen },
    { value: String(instructors.length), label: 'Instructor workspaces', icon: UsersRound },
    { value: averageRating, label: 'Catalog rating proof', icon: Star },
  ];

  return (
    <main
      className="home-theme moe-page overflow-hidden"
      data-home-theme-id={themeId}
      data-home-theme-layout={themeLayout}
      style={style}
    >
      <section className="page-shell grid items-center gap-10 py-10 lg:grid-cols-[0.96fr_1fr] lg:py-12">
        <div>
          <h1
            className="max-w-3xl text-5xl font-black leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-[4.25rem]"
            aria-label={heroTitle.replace(/\s+/g, ' ')}
          >
            {heroTitleFirstLine}
            {heroTitleAccent ? (
              <>
                {' '}
                <span className="block text-[#8b5cf6]">{heroTitleAccent}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            {theme.heroSubtitle || 'Sell courses, run live cohorts, manage instructors, issue certificates, and connect the Flutter mobile app from one polished SaaS package.'}
          </p>

          <form action="/courses" className="moe-control mt-8 flex max-w-2xl items-center gap-3 p-2">
            <Search size={19} className="ml-2 shrink-0 text-slate-400" />
            <input
              name="q"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
              placeholder={theme.searchPlaceholder || 'What do you want to learn?'}
            />
            <button className="moe-primary inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-black transition">
              <Search size={14} />
              {theme.searchButtonLabel || 'Search'}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-5 text-xs font-bold text-slate-300">
            {[
              ['Course commerce', UsersRound],
              ['Live cohorts', Clock3],
              ['Certificates', ShieldCheck],
              ['Mobile-ready API', Play],
            ].map(([label, Icon]) => (
              <span key={String(label)} className="inline-flex items-center gap-2">
                <Icon size={15} className="text-violet-400" />
                {String(label)}
              </span>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="moe-primary inline-flex h-12 items-center rounded-lg px-7 text-sm font-black transition" href={theme.primaryCtaUrl || '/courses'}>
              {theme.primaryCtaLabel || 'Explore Courses'}
            </Link>
            <Link className="moe-control inline-flex h-12 items-center gap-2 px-6 text-sm font-black text-white transition hover:bg-white/10" href={theme.secondaryCtaUrl || '/demo'}>
              {theme.secondaryCtaLabel || 'Platform tour'}
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#0a1020]">
                <Play size={12} fill="currentColor" />
              </span>
            </Link>
          </div>
        </div>

        <div className="moe-hero-orbit relative min-h-[320px] lg:min-h-[430px]">
          <img
            src="/images/modern-lms-hero-learner.png"
            alt=""
            className="relative z-10 mx-auto w-full max-w-[500px] rounded-[28px] object-contain mix-blend-screen drop-shadow-[0_34px_90px_rgba(124,60,255,0.32)]"
          />
          <div className="absolute left-[8%] top-[26%] z-20 hidden h-20 w-20 place-items-center rounded-2xl border border-violet-300/30 bg-violet-600/20 text-violet-200 shadow-[0_0_40px_rgba(124,60,255,0.3)] backdrop-blur md:grid">
            <BarChart3 size={34} />
          </div>
          <div className="absolute right-[8%] top-[30%] z-20 hidden h-20 w-20 place-items-center rounded-2xl border border-violet-300/30 bg-violet-600/20 text-violet-200 shadow-[0_0_40px_rgba(124,60,255,0.3)] backdrop-blur md:grid">
            <Code2 size={34} />
          </div>
        </div>
      </section>

      <section className="page-shell pb-8">
        <div className="moe-panel grid overflow-hidden rounded-xl sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ value, label, icon: Icon }, index) => (
            <div key={label} className={`flex items-center gap-4 px-7 py-5 ${index > 0 ? 'border-t border-violet-300/15 sm:border-l sm:border-t-0' : ''}`}>
              <span className="moe-mini-icon">
                <Icon size={22} />
              </span>
              <div>
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-sm font-semibold text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell py-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-white">{theme.recommendedTitle || 'Popular Learning Paths'}</h2>
          <Link href="/learning-paths" className="text-sm font-bold text-violet-300 hover:text-white">{theme.viewAllLabel || 'View all'}</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dynamicPathCards.map(({ title, courses: count, level, icon: Icon, href }) => (
            <Link key={title} href={href} className="moe-panel moe-card-shine group flex items-center gap-4 rounded-xl p-4 transition hover:-translate-y-1 hover:border-violet-300/45">
              <span className="moe-mini-icon relative z-10">
                <Icon size={22} />
              </span>
              <span className="relative z-10 min-w-0">
                <b className="block truncate text-white">{title}</b>
                <span className="mt-1 block text-xs font-semibold text-slate-400">{count}</span>
                <span className="mt-3 inline-flex rounded-md bg-emerald-400/10 px-2 py-1 text-[11px] font-black text-emerald-300">{level}</span>
              </span>
              <ArrowRight className="relative z-10 ml-auto text-violet-300 opacity-0 transition group-hover:opacity-100" size={18} />
            </Link>
          ))}
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-black text-white">{theme.featuredTitle || 'Browse top courses'}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-400">{theme.featuredSubtitle || 'Practical catalog content, checkout, certificates, dashboards, and mobile API flows ready for buyer configuration.'}</p>
          </div>
          <Link className="moe-control inline-flex h-10 w-fit items-center gap-2 px-4 text-sm font-black text-white" href="/courses">
            {theme.browseAllLabel || 'All courses'}
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {courses.slice(0, 8).map((course) => (
            <CourseCard key={course.id} course={course} currency={settings.currency} locale={settings.defaultLanguage} />
          ))}
        </div>
      </section>

      <section className="page-shell grid gap-5 py-10 md:grid-cols-3">
        {categories.slice(0, 6).map((category) => (
          <Link key={category.id} href={`/categories/${category.slug}`} className="moe-panel rounded-xl p-5 transition hover:-translate-y-1 hover:border-violet-300/45">
            <p className="text-lg font-black text-white">{settings.rtl ? category.nameAr || category.nameEn : category.nameEn}</p>
            <p className="mt-2 text-sm font-semibold text-slate-400">{category._count?.courses || 0} courses ready to explore</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
