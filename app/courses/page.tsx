export const dynamic = 'force-dynamic';

import { ChevronRight, Filter, Search, SlidersHorizontal, Star } from 'lucide-react';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CourseCard } from '@/components/CourseCard';
import { AffiliateTracker } from '@/components/affiliate/AffiliateTracker';
import { prisma } from '@/lib/prisma';
import { languagePresets, localizedCopy } from '@/lib/localized-copy';
import { getSiteSettings } from '@/lib/site-settings';

type CourseSearchParams = {
  q?: string;
  category?: string;
  level?: string;
  language?: string;
  rating?: string;
  duration?: string;
  certificate?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  ref?: string;
};

const levelOptions = ['beginner', 'intermediate', 'advanced'];
const languageOptions = languagePresets.map((language) => language.code);
const ratingOptions = [
  { value: '4', label: '4+ stars' },
  { value: '3', label: '3+ stars' },
  { value: '2', label: '2+ stars' },
];
const sortOptions = [
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Top rated' },
  { value: 'duration-asc', label: 'Shortest' },
  { value: 'duration-desc', label: 'Longest' },
  { value: 'price-asc', label: 'Lowest price' },
  { value: 'price-desc', label: 'Highest price' },
];
const pageSize = 8;

function selectedDurationRange(duration?: string) {
  if (duration === 'short') return { lt: 180 };
  if (duration === 'medium') return { gte: 180, lte: 480 };
  if (duration === 'long') return { gt: 480 };
  return undefined;
}

function averageRating(course: { reviews?: { rating: number }[] }) {
  if (!course.reviews?.length) return 0;
  return course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length;
}

function coursePrice(course: { isFree: boolean; salePrice: any; price: any }) {
  if (course.isFree) return 0;
  return Number(course.salePrice ?? course.price ?? 0);
}

function selectedPriceRange(searchParams: CourseSearchParams) {
  const minValue = searchParams.minPrice === undefined || searchParams.minPrice === '' ? null : Number(searchParams.minPrice);
  const maxValue = searchParams.maxPrice === undefined || searchParams.maxPrice === '' ? null : Number(searchParams.maxPrice);
  return {
    minPrice: Number.isFinite(minValue) && minValue !== null && minValue >= 0 ? minValue : null,
    maxPrice: Number.isFinite(maxValue) && maxValue !== null && maxValue >= 0 ? maxValue : null,
  };
}

function buildCourseWhere(searchParams: CourseSearchParams) {
  const where: any = { status: 'PUBLISHED' };
  const q = searchParams.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { shortDescription: { contains: q } },
      { fullDescription: { contains: q } },
      { category: { nameEn: { contains: q } } },
    ];
  }
  if (searchParams.category) where.categoryId = searchParams.category;
  if (searchParams.level && levelOptions.includes(searchParams.level)) where.level = searchParams.level;
  if (searchParams.language && (languageOptions as readonly string[]).includes(searchParams.language)) where.language = searchParams.language;
  if (searchParams.certificate === 'yes') where.includesCertificate = true;
  if (searchParams.certificate === 'no') where.includesCertificate = false;
  const durationRange = selectedDurationRange(searchParams.duration);
  if (durationRange) where.durationMinutes = durationRange;
  return where;
}

function selectedOrder(searchParams: CourseSearchParams) {
  if (searchParams.sort === 'duration-asc') return { durationMinutes: 'asc' as const };
  if (searchParams.sort === 'duration-desc') return { durationMinutes: 'desc' as const };
  return { createdAt: 'desc' as const };
}

export default async function Courses(props: { searchParams: Promise<CourseSearchParams> }) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.page || 1) || 1);
  const [categories, courseRows, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { nameEn: 'asc' } }),
    prisma.course.findMany({ where: buildCourseWhere(searchParams), include: { category: true, instructor: true, reviews: true, enrollments: true }, orderBy: selectedOrder(searchParams) }),
    getSiteSettings(),
  ]);
  const { minPrice, maxPrice } = selectedPriceRange(searchParams);
  const minRating = Number(searchParams.rating || 0);
  const courses = courseRows
    .filter((course) => !minRating || averageRating(course) >= minRating)
    .filter((course) => {
      const price = coursePrice(course);
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    })
    .sort((a, b) => {
      if (!searchParams.sort || searchParams.sort === 'popular') return (b.enrollments?.length || 0) - (a.enrollments?.length || 0) || b.createdAt.getTime() - a.createdAt.getTime();
      if (searchParams.sort === 'rating') return averageRating(b) - averageRating(a);
      if (searchParams.sort === 'price-asc') return coursePrice(a) - coursePrice(b);
      if (searchParams.sort === 'price-desc') return coursePrice(b) - coursePrice(a);
      return 0;
    });
  const totalPages = Math.max(1, Math.ceil(courses.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCourses = courses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const copy = localizedCopy(settings.defaultLanguage);
  const categoryName = (category: { nameEn: string; nameAr?: string | null }) => settings.rtl ? category.nameAr || category.nameEn : category.nameEn;
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key !== 'page' && value) params.set(key, value);
    });
    if (targetPage > 1) params.set('page', String(targetPage));
    const query = params.toString();
    return query ? `/courses?${query}` : '/courses';
  };

  return (
    <>
      {searchParams.ref ? <AffiliateTracker /> : null}
      <Nav />
      <main className="moe-page">
        <section className="page-shell grid gap-8 py-8 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <form className="moe-panel grid gap-6 rounded-xl p-4" action="/courses">
              <div>
                <p className="mb-3 text-sm font-black text-white">Categories</p>
                <div className="grid gap-1.5">
                  <Link className={`flex h-9 items-center justify-between rounded-lg px-3 text-xs font-black ${!searchParams.category ? 'bg-violet-600/45 text-white' : 'text-slate-300 hover:bg-white/5'}`} href="/courses">
                    All Categories
                    <ChevronRight size={14} />
                  </Link>
                  {categories.slice(0, 9).map((category) => (
                    <Link key={category.id} href={`/courses?category=${category.id}`} className={`flex h-9 items-center justify-between rounded-lg px-3 text-xs font-bold ${searchParams.category === category.id ? 'bg-violet-600/45 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
                      {categoryName(category)}
                      <ChevronRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>

              <div className="border-t border-violet-300/15 pt-4">
                <p className="mb-3 text-sm font-black text-white">Level</p>
                <div className="grid gap-2 text-xs font-semibold text-slate-300">
                  <label className="flex items-center gap-2"><input type="radio" name="level" value="" defaultChecked={!searchParams.level} /> All Levels</label>
                  {levelOptions.map((level) => (
                    <label key={level} className="flex items-center gap-2 capitalize"><input type="radio" name="level" value={level} defaultChecked={searchParams.level === level} /> {level}</label>
                  ))}
                </div>
              </div>

              <div className="border-t border-violet-300/15 pt-4">
                <p className="mb-3 text-sm font-black text-white">Rating</p>
                <select className="moe-control h-10 w-full px-3 text-xs font-bold" name="rating" defaultValue={searchParams.rating || ''}>
                  <option value="">Any Rating</option>
                  {ratingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="border-t border-violet-300/15 pt-4">
                <p className="mb-3 text-sm font-black text-white">Price</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Min
                    <input className="moe-control mt-1 h-10 w-full px-3 text-xs font-bold" name="minPrice" type="number" min="0" step="1" inputMode="numeric" defaultValue={minPrice ?? ''} placeholder="0" />
                  </label>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Max
                    <input className="moe-control mt-1 h-10 w-full px-3 text-xs font-bold" name="maxPrice" type="number" min="0" step="1" inputMode="numeric" defaultValue={maxPrice ?? ''} placeholder="200" />
                  </label>
                </div>
              </div>

              <input type="hidden" name="q" value={searchParams.q || ''} />
              <input type="hidden" name="category" value={searchParams.category || ''} />
              <input type="hidden" name="language" value={searchParams.language || ''} />
              <input type="hidden" name="duration" value={searchParams.duration || ''} />
              <input type="hidden" name="certificate" value={searchParams.certificate || ''} />
              <input type="hidden" name="sort" value={searchParams.sort || ''} />
              <button className="moe-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-black transition">
                <Filter size={15} />
                Filters
              </button>
            </form>
          </aside>

          <div className="min-w-0">
            <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-4xl font-black text-white">Browse Courses</h1>
                <p className="mt-2 text-sm font-semibold text-slate-400">Explore thousands of courses and find the right one for you.</p>
              </div>
              <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/courses">
                <input type="hidden" name="category" value={searchParams.category || ''} />
                <input type="hidden" name="level" value={searchParams.level || ''} />
                <input type="hidden" name="language" value={searchParams.language || ''} />
                <input type="hidden" name="rating" value={searchParams.rating || ''} />
                <input type="hidden" name="duration" value={searchParams.duration || ''} />
                <input type="hidden" name="certificate" value={searchParams.certificate || ''} />
                <input type="hidden" name="minPrice" value={searchParams.minPrice || ''} />
                <input type="hidden" name="maxPrice" value={searchParams.maxPrice || ''} />
                <label className="moe-control flex h-11 min-w-0 items-center gap-3 px-3 sm:w-[360px]">
                  <Search size={16} className="shrink-0 text-slate-400" />
                  <input className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-500" name="q" placeholder="Search courses, skills or topics..." defaultValue={searchParams.q || ''} />
                </label>
                <button className="moe-control inline-flex h-11 items-center justify-center gap-2 px-4 text-xs font-black text-white">
                  <SlidersHorizontal size={15} />
                  Filters
                </button>
                <select className="moe-control h-11 px-4 text-xs font-black text-white" name="sort" defaultValue={searchParams.sort || 'newest'} aria-label="Sort courses">
                  {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </form>
            </div>

            {visibleCourses.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {visibleCourses.map((course) => (
                  <CourseCard key={course.id} course={course} currency={settings.currency} locale={settings.defaultLanguage} />
                ))}
              </div>
            ) : (
              <div className="moe-panel rounded-xl border-dashed p-10 text-center">
                <Star className="mx-auto text-violet-300" size={34} />
                <h2 className="mt-4 text-2xl font-black text-white">{copy.coursesPage.noResultsTitle}</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">{copy.coursesPage.noResultsBody}</p>
              </div>
            )}

            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-2" aria-label={copy.coursesPage.paginationLabel}>
                <Link className={`moe-control grid h-9 w-9 place-items-center text-sm font-black ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`} href={pageHref(Math.max(1, currentPage - 1))}>‹</Link>
                {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 6).map((targetPage) => (
                  <Link
                    key={targetPage}
                    className={`grid h-9 min-w-9 place-items-center rounded-lg border px-3 text-sm font-black ${
                      targetPage === currentPage ? 'border-violet-400 bg-violet-600 text-white' : 'border-violet-300/20 text-slate-300 hover:bg-white/5'
                    }`}
                    href={pageHref(targetPage)}
                    aria-current={targetPage === currentPage ? 'page' : undefined}
                  >
                    {targetPage}
                  </Link>
                ))}
                <Link className={`moe-control grid h-9 w-9 place-items-center text-sm font-black ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`} href={pageHref(Math.min(totalPages, currentPage + 1))}>›</Link>
              </nav>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
