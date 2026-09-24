/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Clock3, ImageIcon, ShoppingCart, Star, UserRound } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { localizedCopy } from '@/lib/localized-copy';
import { formatMoney } from '@/lib/site-settings';

export function CourseCard({ course, currency = 'USD', locale = 'en' }: { course: any; currency?: string; locale?: string }) {
  const copy = localizedCopy(locale);
  const levelLabels: Record<string, string> = {
    beginner: copy.coursesPage.beginner,
    intermediate: copy.coursesPage.intermediate,
    advanced: copy.coursesPage.advanced
  };
  const price = course.isFree ? copy.courseCard.free : formatMoney(course.salePrice ?? course.price, currency);
  const level = levelLabels[String(course.level || '').toLowerCase()] || course.level || copy.courseCard.allLevels;
  const instructor = course.instructor?.name || copy.courseCard.instructorFallback;
  const hours = Math.max(1, Math.round((course.durationMinutes || 0) / 60));
  const categoryName = String(locale).startsWith('ar') ? course.category?.nameAr || course.category?.nameEn : course.category?.nameEn || course.category?.nameAr;
  const rating = course.reviews?.length
    ? (course.reviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) / course.reviews.length).toFixed(1)
    : null;
  const reviewCount = course.reviews?.length || 0;

  return (
    <article className="moe-panel group flex h-full flex-col overflow-hidden rounded-xl transition duration-300 hover:-translate-y-1 hover:border-violet-300/45 hover:shadow-[0_22px_70px_rgba(124,60,255,0.20)]">
      <Link href={`/courses/${course.slug}`} className="block" aria-label={`View ${course.title}`}>
      <div className="relative aspect-[1.46] overflow-hidden border-b border-violet-300/15 bg-[#0d1428]">
        {course.coverImage ? (
          <img src={course.coverImage} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_center,rgba(124,60,255,0.26),transparent_70%)] text-violet-300">
            <ImageIcon size={42} strokeWidth={1.6} />
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-amber-400 px-2.5 text-[10px] font-black uppercase text-[#1f1300]">
          {level}
        </span>
        {rating && (
          <span className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2.5 text-xs font-black text-white backdrop-blur">
            <Star size={13} strokeWidth={2} className="fill-amber-400 text-amber-400" />
            {rating}
          </span>
        )}
      </div>
      </Link>

      <div className="relative z-10 flex flex-1 flex-col p-4">
        <p className="truncate text-[12px] font-bold text-violet-300">{categoryName || copy.common.course}</p>
        <Link href={`/courses/${course.slug}`} className="mt-2 line-clamp-2 min-h-[2.7rem] text-[15px] font-black leading-snug text-white hover:text-violet-200">
          {course.title}
        </Link>
        <p className="mt-1.5 inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-400">
          <UserRound size={13} strokeWidth={1.8} className="shrink-0" />
          <span className="truncate">{instructor}</span>
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 text-[12px] font-bold text-slate-400">
          <span className="inline-flex items-center gap-1.5 text-amber-300">
            <Star size={13} strokeWidth={2} className="fill-amber-400 text-amber-400" />
            {rating || 'New'} <span className="text-slate-500">({reviewCount})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} strokeWidth={1.8} />
            {hours} hours
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 pt-4">
          <span className="text-sm font-black text-white">{price}</span>
          <form action="/api/cart/add" method="post">
            <CsrfInput />
            <input type="hidden" name="courseId" value={course.id} />
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-violet-300/25 bg-violet-600/15 text-violet-200 transition hover:bg-violet-600 hover:text-white" type="submit" aria-label={`Add ${course.title} to cart`}>
            <ShoppingCart size={16} strokeWidth={1.9} />
          </button>
          </form>
        </div>
      </div>
    </article>
  );
}
