export const dynamic = 'force-dynamic';

import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowUpRight, Building2 } from 'lucide-react';
import { CourseCard } from '@/components/CourseCard';
import { ModernMarketplaceHome } from '@/components/ModernMarketplaceHome';
import { getCached } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { BoldVibrantTheme } from '@/components/themes/BoldVibrantTheme';
import { ClassicAcademicTheme } from '@/components/themes/ClassicAcademicTheme';
import { DarkTechTheme } from '@/components/themes/DarkTechTheme';
import { EditorialMagazineTheme } from '@/components/themes/EditorialMagazineTheme';
import { GlassPastelTheme } from '@/components/themes/GlassPastelTheme';
import { ModernMinimalTheme } from '@/components/themes/ModernMinimalTheme';
import { getHomeThemeDefinition, parseHomeThemeId, type HomeThemeId, type HomeThemeLayout } from '@/lib/home-theme-registry';
import { getHomeSectionSettings, homeSectionEnabled } from '@/lib/home-sections';
import { themeStyle } from '@/lib/theme-style';
import { formatMoney } from '@/lib/site-settings';

// Course shape expected by the four theme components in components/themes/*.
// Matches the HomeThemeRenderProps['courses'] element type defined in those
// modules: price/salePrice are plain numbers (Prisma Decimal is converted via
// `normalizeCourses` before being passed to a theme component).
type CourseWithRelations = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImage: string | null;
  price: number;
  salePrice: number | null;
  isFree: boolean;
  category: { id: string; nameEn: string; nameAr?: string | null; slug: string } | null;
  instructor: { id: string; name: string } | null;
  enrollments: { id: string }[];
  reviews: { id: string; rating: number; comment: string | null }[];
};

type HomeThemeRenderer = (props: any) => React.ReactNode;

const homeThemeRenderers: Record<HomeThemeLayout, HomeThemeRenderer> = {
  'modern-minimal': ModernMinimalTheme,
  'bold-vibrant': BoldVibrantTheme,
  'classic-academic': ClassicAcademicTheme,
  'dark-tech': DarkTechTheme,
  'editorial-magazine': EditorialMagazineTheme,
  'glass-pastel': GlassPastelTheme,
  'learnova-default': ModernMarketplaceHome,
};

async function fetchHomeData() {
  const now = new Date();
  const [courses, sliders, categories, instructors, reviews, subscriptionPlans, blogPosts, sponsorships, settings, homeSections] = await Promise.all([
    prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      take: 8,
      include: { category: true, instructor: true, enrollments: true, reviews: true },
      orderBy: { createdAt: 'desc' }
    }),
    (prisma as any).slider.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, take: 1 }).catch(() => []),
    prisma.category
      .findMany({ include: { _count: { select: { courses: true } } }, orderBy: { nameEn: 'asc' }, take: 6 })
      .catch(() => []),
    prisma.user
      .findMany({ where: { role: 'INSTRUCTOR', status: 'APPROVED' }, take: 4, orderBy: { createdAt: 'desc' } })
      .catch(() => []),
    prisma.review
      .findMany({ include: { user: true, course: true }, orderBy: { createdAt: 'desc' }, take: 3 })
      .catch(() => []),
    prisma.subscriptionPlan
      .findMany({ where: { active: true }, orderBy: { price: 'asc' }, take: 3 })
      .catch(() => []),
    prisma.blogPost
      .findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 3 })
      .catch(() => []),
    prisma.sponsorship
      .findMany({
        where: {
          active: true,
          placement: 'homepage',
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { createdAt: 'desc' },
        take: 2,
      })
      .catch(() => []),
    getSiteSettings(),
    getHomeSectionSettings()
  ]);

  return { courses, sliders, categories, instructors, reviews, subscriptionPlans, blogPosts, sponsorships, settings, homeSections };
}

async function getHomeData() {
  return getCached('home:page', fetchHomeData, {
    ttlSeconds: 120,
    staleSeconds: 180,
    tags: ['home', 'courses', 'settings', 'theme'],
  });
}

async function tenantHomeForRequest() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(',')[0]?.trim().split(':')[0]?.toLowerCase();
  if (!host || ['localhost', '127.0.0.1', '::1'].includes(host)) return null;
  const tenant = await prisma.tenant.findFirst({ where: { domain: host, active: true } });
  if (!tenant) return null;
  const mappings = await prisma.tenantCourse.findMany({ where: { tenantId: tenant.id }, orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }] });
  const courses = mappings.length
    ? await prisma.course.findMany({
        where: { id: { in: mappings.map((mapping) => mapping.courseId) }, status: 'PUBLISHED' },
        include: { category: true, instructor: true, reviews: true },
      })
    : [];
  return { tenant, courses };
}

function TenantDomainHome({ tenant, courses, settings }: { tenant: any; courses: any[]; settings: Awaited<ReturnType<typeof getHomeData>>['settings'] }) {
  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <Building2 size={23} />
            </span>
            <h1 className="mt-5 text-5xl font-black text-white">{tenant.name}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Private learning portal with curated courses, team-ready training, and branded marketplace access.
            </p>
          </div>
        </section>
        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.length ? courses.map((course) => <CourseCard key={course.id} course={course} currency={settings.currency} locale={settings.defaultLanguage} />) : (
            <div className="moe-panel rounded-2xl p-6 text-sm font-semibold text-slate-300 md:col-span-2 xl:col-span-3">
              No published courses have been assigned to this tenant yet.
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

/**
 * Convert Prisma Decimal-typed price/salePrice fields to plain numbers so
 * they satisfy the strict `price: number` shape declared by the theme
 * components in `components/themes/*`.
 */
function normalizeCourses(courses: Awaited<ReturnType<typeof getHomeData>>['courses']): CourseWithRelations[] {
  return courses.map((course) => ({
    ...course,
    price: Number(course.price),
    salePrice: course.salePrice == null ? null : Number(course.salePrice)
  })) as CourseWithRelations[];
}

function SupplementalHomeSections({
  homeSections,
  subscriptionPlans,
  blogPosts,
  sponsorships,
  settings,
}: {
  homeSections: Awaited<ReturnType<typeof getHomeData>>['homeSections'];
  subscriptionPlans: Awaited<ReturnType<typeof getHomeData>>['subscriptionPlans'];
  blogPosts: Awaited<ReturnType<typeof getHomeData>>['blogPosts'];
  sponsorships: Awaited<ReturnType<typeof getHomeData>>['sponsorships'];
  settings: Awaited<ReturnType<typeof getHomeData>>['settings'];
}) {
  const showSubscriptions = homeSectionEnabled(homeSections, 'subscriptions');
  const showBlog = homeSectionEnabled(homeSections, 'blog');

  if ((!showSubscriptions || subscriptionPlans.length === 0) && (!showBlog || blogPosts.length === 0) && sponsorships.length === 0) return null;

  return (
    <section className="border-t border-white/10 bg-black py-12">
      {sponsorships.length > 0 ? (
        <div className="page-shell mb-8 grid gap-4 md:grid-cols-2">
          {sponsorships.map((item) => {
            const content = (
              <>
                {item.imageUrl ? <Image unoptimized className="h-12 w-12 object-contain" src={item.imageUrl} alt="" width={48} height={48} /> : null}
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#1D9BF0]">Sponsored</p>
                <h2 className="mt-2 text-2xl font-black text-white">{item.sponsor}</h2>
                {item.targetUrl ? (
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#1D9BF0]">
                    Learn more
                    <ArrowUpRight size={16} />
                  </span>
                ) : null}
              </>
            );
            return item.targetUrl ? (
              <Link key={item.id} href={item.targetUrl} className="border border-[#2F3336] bg-[#050505] p-6 transition hover:bg-[#16181C]">
                {content}
              </Link>
            ) : (
              <article key={item.id} className="border border-[#2F3336] bg-[#050505] p-6">
                {content}
              </article>
            );
          })}
        </div>
      ) : null}
      <div className="page-shell grid gap-8 lg:grid-cols-2">
        {showSubscriptions && subscriptionPlans.length > 0 ? (
          <div className="border border-[#2F3336] bg-[#050505] p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#1D9BF0]">Membership</p>
                <h2 className="mt-2 text-2xl font-black text-white">Subscription plans</h2>
              </div>
              <Link className="text-sm font-bold text-[#1D9BF0] hover:text-white" href="/pricing">
                View pricing
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {subscriptionPlans.map((plan) => (
                <Link
                  key={plan.id}
                  href="/pricing"
                  className="flex items-center justify-between gap-4 border border-[#2F3336] bg-black p-4 transition hover:bg-[#16181C]"
                >
                  <span>
                    <b className="block text-white">{plan.name}</b>
                    <span className="mt-1 block text-xs font-semibold text-[#71767B]">{plan.interval}</span>
                  </span>
                  <span className="text-right text-lg font-black text-white">{formatMoney(Number(plan.price), settings.currency)}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {showBlog && blogPosts.length > 0 ? (
          <div className="border border-[#2F3336] bg-[#050505] p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#1D9BF0]">Editorial</p>
                <h2 className="mt-2 text-2xl font-black text-white">Latest articles</h2>
              </div>
              <Link className="text-sm font-bold text-[#1D9BF0] hover:text-white" href="/blog">
                Read blog
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {blogPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="block border border-[#2F3336] bg-black p-4 transition hover:bg-[#16181C]"
                >
                  <b className="line-clamp-1 block text-white">{post.title}</b>
                  <span className="mt-2 line-clamp-2 text-sm leading-6 text-[#71767B]">{post.excerpt}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default async function Home(props: { searchParams?: Promise<{ previewTheme?: string }> }) {
  const { courses, sliders, categories, instructors, reviews, subscriptionPlans, blogPosts, sponsorships, settings, homeSections } = await getHomeData();
  const tenantHome = await tenantHomeForRequest();
  if (tenantHome) return <TenantDomainHome tenant={tenantHome.tenant} courses={tenantHome.courses} settings={settings} />;
  const searchParams = await props.searchParams;
  const previewTheme = searchParams?.previewTheme ? parseHomeThemeId(searchParams.previewTheme) : null;
  const activeThemeId = previewTheme || settings.homeTheme;
  const activeTheme = getHomeThemeDefinition(activeThemeId);
  const ThemeRenderer = homeThemeRenderers[activeTheme.layout];
  const normalizedCourses = normalizeCourses(courses);
  const themedCourses = homeSectionEnabled(homeSections, 'featuredCourses') ? normalizedCourses : [];
  const themedCategories = homeSectionEnabled(homeSections, 'categories') ? categories : [];
  const themedInstructors = homeSectionEnabled(homeSections, 'instructors') ? instructors : [];
  const themedReviews = homeSectionEnabled(homeSections, 'reviews') ? reviews : [];
  const themedSlide = homeSectionEnabled(homeSections, 'heroSlider') ? sliders[0] : undefined;

  if (activeTheme.layout === 'learnova-default') {
    return (
      <>
        <Nav />
        <ModernMarketplaceHome
          courses={themedCourses}
          categories={themedCategories}
          instructors={themedInstructors}
          settings={settings}
          theme={settings.homeThemes[activeThemeId]}
          themeId={activeTheme.id}
          themeLayout={activeTheme.layout}
          style={themeStyle(settings, settings.homeThemes[activeTheme.id])}
        />
        <SupplementalHomeSections homeSections={homeSections} subscriptionPlans={subscriptionPlans} blogPosts={blogPosts} sponsorships={sponsorships} settings={settings} />
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main
        className="home-theme"
        data-home-theme-id={activeTheme.id}
        data-home-theme-layout={activeTheme.layout}
        style={themeStyle(settings, settings.homeThemes[activeTheme.id])}
      >
        <ThemeRenderer
          themeId={activeTheme.id as HomeThemeId}
          courses={themedCourses}
          categories={themedCategories}
          instructors={themedInstructors}
          reviews={themedReviews}
          slide={themedSlide}
          settings={settings}
        />
      </main>
      <SupplementalHomeSections homeSections={homeSections} subscriptionPlans={subscriptionPlans} blogPosts={blogPosts} sponsorships={sponsorships} settings={settings} />
      <Footer />
    </>
  );
}
