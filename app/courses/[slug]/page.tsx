/* eslint-disable @next/next/no-img-element */
import { couponLabel, validateCouponForCheckout } from '@/lib/coupons';
import { fromJsonArray } from '@/lib/json-fields';
import { getSession } from '@/lib/auth';
import { gatewayLabels, getActivePaymentMethods } from '@/lib/payment-gateways';
import { localizedPageCopy } from '@/lib/page-copy';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, cleanDescription, jsonLd, seo } from '@/lib/seo';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';
import { currentAppUrl } from '@/lib/request-url';
import { CsrfInput } from '@/components/CsrfInput';
import { ArrowLeft, ArrowRight, BadgePercent, BookOpen, CheckCircle2, Clock3, Flag, Heart, Layers3, MessageCircle, PlayCircle, ShoppingCart, Star, ThumbsUp, UserRound } from 'lucide-react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

const metricText = 'text-[13px] font-semibold text-slate-400';
const border = 'border-violet-300/20';
const inputClass =
  'moe-control h-12 w-full px-5 text-[15px] font-semibold text-white';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const course = await prisma.course.findFirst({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: { category: true, instructor: true },
  });
  if (!course) {
    return seo({ title: 'Course not found', description: 'This course is not available.', path: `/courses/${params.slug}`, baseUrl: await currentAppUrl() });
  }

  return seo({
    title: course.title,
    description: cleanDescription(course.shortDescription || course.fullDescription),
    path: `/courses/${course.slug}`,
    image: course.coverImage,
    baseUrl: await currentAppUrl(),
  });
}

export default async function CourseDetails(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ coupon?: string | string[] }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getSession();
  const couponQuery = Array.isArray(searchParams?.coupon) ? searchParams?.coupon[0] : searchParams?.coupon;
  const requestedCoupon = couponQuery?.trim().slice(0, 64).toUpperCase() || '';
  const course = await prisma.course.findFirst({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: {
      category: true,
      instructor: true,
      enrollments: true,
      modules: { include: { lessons: true } },
      reviews: { include: { user: true } },
      questions: { include: { user: true }, orderBy: { createdAt: 'desc' }, take: 8 },
      _count: { select: { questions: true } },
    },
  });
  if (!course) notFound();
  const checkoutSubtotal = course.isFree ? 0 : Number(course.salePrice ?? course.price ?? 0);
  const [couponCandidates, paymentMethods, settings, requestedCouponResult] = await Promise.all([
    prisma.coupon.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      orderBy: { percent: 'desc' },
      take: 8,
    }),
    getActivePaymentMethods(),
    getSiteSettings(),
    requestedCoupon
      ? validateCouponForCheckout({
          code: requestedCoupon,
          userId: session?.id || '',
          lines: [{ courseId: course.id, amount: checkoutSubtotal }],
        })
      : Promise.resolve(null),
  ]);
  const copy = localizedPageCopy(settings.defaultLanguage).catalog;
  const categoryName = settings.rtl ? course.category?.nameAr || course.category?.nameEn : course.category?.nameEn || course.category?.nameAr;
  const activeCoupons = couponCandidates
    .filter((coupon) => {
      const scopedIds = fromJsonArray<string>(coupon.courseIds);
      return !scopedIds.length || scopedIds.includes(course.id);
    })
    .slice(0, 3);

  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || null;
  await prisma.courseView.create({ data: { courseId: course.id, userId: session?.id, ip } }).catch(() => null);
  const outcomes = fromJsonArray<string>(course.outcomes);
  const requirements = fromJsonArray<string>(course.requirements);
  const targetAudience = fromJsonArray<string>(course.targetAudience);
  const lessonCount = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const avg = course.reviews.length
    ? Math.round((course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length) * 10) / 10
    : 0;
  const price = checkoutSubtotal;
  const validRequestedCoupon = requestedCouponResult?.valid ? requestedCouponResult : null;
  const couponPreviewTotal = validRequestedCoupon ? Math.max(0, price - validRequestedCoupon.discount) : price;
  const appUrl = await currentAppUrl(settings.publicAppUrl);
  const courseUrl = absoluteUrl(`/courses/${course.slug}`, appUrl);
  const isFavorited = session?.id
    ? Boolean(await prisma.favorite.findUnique({ where: { userId_courseId: { userId: session.id, courseId: course.id } }, select: { id: true } }))
    : false;
  const enrolledReviewers = new Set(course.enrollments.map((enrollment) => enrollment.userId));
  const currentEnrollment = session?.id ? course.enrollments.find((enrollment) => enrollment.userId === session.id) : null;
  const reviewEligible = Boolean(currentEnrollment && (currentEnrollment.completedAt || currentEnrollment.progress >= 20));
  const canPostBuyerContent = session?.role === 'STUDENT' && enrolledReviewers.has(session.id);
  const canReviewCourse = canPostBuyerContent && reviewEligible;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: cleanDescription(course.fullDescription || course.shortDescription),
    url: courseUrl,
    image: course.coverImage ? absoluteUrl(course.coverImage, appUrl) : undefined,
    inLanguage: course.language,
    courseCode: course.slug,
    educationalLevel: course.level,
    timeRequired: course.durationMinutes ? `PT${course.durationMinutes}M` : undefined,
    provider: {
      '@type': 'Organization',
      name: settings.siteName,
      url: absoluteUrl('/', appUrl),
    },
    creator: {
      '@type': 'Person',
      name: course.instructor.name,
    },
    about: course.category?.nameEn,
    teaches: outcomes.length ? outcomes : undefined,
    aggregateRating: course.reviews.length ? {
      '@type': 'AggregateRating',
      ratingValue: avg,
      reviewCount: course.reviews.length,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    offers: {
      '@type': 'Offer',
      url: courseUrl,
      price: course.isFree ? 0 : price,
      priceCurrency: settings.currency,
      availability: course.status === 'PUBLISHED' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      category: course.isFree ? 'Free' : 'Paid',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      instructor: {
        '@type': 'Person',
        name: course.instructor.name,
      },
    },
  };

  const metrics = [
    { label: copy.rating, value: avg ? `${avg}/5` : copy.newLabel, icon: Star },
    { label: copy.students, value: course.enrollments.length, icon: UserRound },
    { label: copy.lessonsLabel, value: lessonCount, icon: BookOpen },
    { label: copy.level, value: course.level || copy.allLevels, icon: Layers3 },
    { label: copy.certificate, value: course.includesCertificate ? copy.yes : copy.no, icon: CheckCircle2 },
  ];

  return (
    <main className="moe-page text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <div className="page-shell grid min-h-screen gap-6 pb-28 pt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-10">
        <section className="min-w-0 overflow-hidden rounded-xl border border-violet-300/20 bg-black/10">
          <header className="moe-sidebar sticky top-0 z-20 border-b px-5 py-3">
            <div className="flex items-center gap-5">
              <a className="moe-control grid h-10 w-10 place-items-center transition hover:bg-white/10" href="/courses" aria-label={copy.backToCourses}>
                <ArrowLeft size={20} strokeWidth={1.8} />
              </a>
              <div>
                <p className="text-xl font-bold leading-6">{course.title}</p>
                <p className={metricText}>{lessonCount} {lessonCount === 1 ? copy.lessonLabel : copy.lessonsLabel}</p>
              </div>
            </div>
          </header>

          <section className={`border-b ${border} px-5 py-8 sm:px-8`}>
            {(course.coverImage || course.promoVideo) && (
              <div className="moe-video-frame mb-8 overflow-hidden rounded-xl p-2">
                {course.promoVideo && /\.(mp4|webm|ogg)(\?.*)?$/i.test(course.promoVideo) ? (
                  <video
                    className="aspect-video w-full rounded-lg bg-black object-cover"
                    src={course.promoVideo}
                    poster={course.coverImage || undefined}
                    controls
                    controlsList="nodownload"
                    disablePictureInPicture
                    playsInline
                  />
                ) : course.promoVideo ? (
                  <a className="flex aspect-video items-center justify-center gap-3 rounded-lg text-lg font-bold text-white transition hover:bg-white/10" href={course.promoVideo} target="_blank" rel="noreferrer">
                    <PlayCircle className="text-violet-200" size={34} strokeWidth={1.7} />
                    {copy.watchPromo}
                  </a>
                ) : course.coverImage ? (
                  <img src={course.coverImage} alt="" className="aspect-video w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center gap-3 rounded-lg border border-violet-300/15 bg-white/[0.03] text-lg font-bold text-slate-300">
                    <PlayCircle className="text-violet-200" size={34} strokeWidth={1.7} />
                    {copy.watchPromo}
                  </div>
                )}
              </div>
            )}
            <p className="text-[15px] font-bold text-violet-200">{categoryName || copy.courseFallback}</p>
            <h1 className="moe-gradient-text mt-4 max-w-4xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">{course.title}</h1>
            <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-300">{course.shortDescription}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a className="moe-primary inline-flex h-12 items-center gap-2 rounded-lg px-6 text-[15px] font-black transition" href="#enroll">
                {copy.enrollNow}
                <ArrowRight size={18} strokeWidth={1.8} />
              </a>
              <a className="moe-control inline-flex h-12 items-center gap-2 px-6 text-[15px] font-black text-white transition hover:bg-white/10" href="#curriculum">
                {copy.viewCurriculum}
              </a>
            </div>
          </section>

          <section className={`grid grid-cols-2 border-b ${border} xl:grid-cols-5`}>
            {metrics.map(({ label, value, icon: Icon }) => (
              <div className={`min-w-0 border-b ${border} px-4 py-5 sm:px-5 xl:border-b-0 xl:border-r xl:last:border-r-0`} key={label}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="moe-mini-icon h-9 w-9 shrink-0 rounded-lg">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className={`${metricText} truncate`}>{label}</span>
                </div>
                <p className="mt-3 min-w-0 break-words text-xl font-extrabold leading-tight sm:text-2xl xl:text-xl 2xl:text-2xl">{value}</p>
              </div>
            ))}
          </section>

          <section className={`border-b ${border} px-5 py-8 sm:px-8`}>
            <h2 className="text-2xl font-extrabold">{copy.whatLearn}</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {(outcomes.length ? outcomes : [copy.outcomeFallback]).map((outcome, index) => (
                <li className="flex gap-3 text-[15px] leading-6 text-slate-300" key={index}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-violet-200" size={18} strokeWidth={1.8} />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`border-b ${border} px-5 py-8 sm:px-8`}>
            <h2 className="text-2xl font-extrabold">{copy.requirements}</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {(requirements.length ? requirements : [copy.requirementsFallback]).map((requirement, index) => (
                <li className="flex gap-3 text-[15px] leading-6 text-slate-300" key={index}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-violet-200" size={18} strokeWidth={1.8} />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`border-b ${border} px-5 py-8 sm:px-8`}>
            <h2 className="text-2xl font-extrabold">{copy.audienceTitle}</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {(targetAudience.length ? targetAudience : [copy.audienceFallback]).map((audience, index) => (
                <li className="flex gap-3 text-[15px] leading-6 text-slate-300" key={index}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-violet-200" size={18} strokeWidth={1.8} />
                  <span>{audience}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`border-b ${border} px-5 py-8 sm:px-8`}>
            <h2 className="text-2xl font-extrabold">{copy.instructor}</h2>
            <div className="moe-panel mt-6 flex flex-col gap-5 rounded-xl p-5 sm:flex-row sm:items-center">
              {course.instructor.avatar ? (
                <img src={course.instructor.avatar} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="moe-mini-icon h-20 w-20 shrink-0">
                  <UserRound size={28} />
                </span>
              )}
              <div className="min-w-0">
                <h3 className="text-xl font-black">{course.instructor.name}</h3>
                <p className="mt-2 text-[15px] leading-6 text-slate-300">
                  {course.instructor.bio || 'Lead instructor for this course.'}
                </p>
              </div>
            </div>
          </section>

          <section className={`border-b ${border} px-5 py-8 sm:px-8`} id="curriculum">
            <h2 className="text-2xl font-extrabold">{copy.curriculum}</h2>
            <div className="mt-6">
              {course.modules.map((module) => (
                <div className={`border-t ${border} py-5 first:border-t-0 first:pt-0`} key={module.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{module.title}</h3>
                      <p className={metricText}>{module.lessons.length} {module.lessons.length === 1 ? copy.lessonLabel : copy.lessonsLabel}</p>
                    </div>
                    <BookOpen className="shrink-0 text-violet-200" size={20} strokeWidth={1.7} />
                  </div>
                  <ul className="mt-4 grid gap-3">
                    {module.lessons.map((lesson) => (
                      <li className="moe-panel-soft flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-[15px] text-slate-300" key={lesson.id}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Clock3 className="shrink-0 text-slate-400" size={16} strokeWidth={1.7} />
                          <span className="truncate">{lesson.title}</span>
                          <span className="shrink-0 text-slate-400">/ {lesson.type}</span>
                        </div>
                        {lesson.isPreview && (
                          <a
                            className="moe-control inline-flex h-9 shrink-0 items-center gap-2 px-3 text-[13px] font-bold text-violet-100 transition hover:bg-white/10"
                            href={`/learn/${course.slug}?lesson=${lesson.id}&preview=1`}
                          >
                            <PlayCircle size={15} strokeWidth={1.8} />
                            {copy.previewFree}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className={`grid border-b ${border} lg:grid-cols-2`}>
            <div className={`border-b ${border} px-5 py-8 lg:border-b-0 lg:border-r sm:px-8`}>
              <h2 className="text-2xl font-extrabold">{copy.reviews}</h2>
              {course.reviews.length ? (
                course.reviews.map((review) => (
                  <article className={`border-t ${border} py-5 first:mt-4 first:border-t-0`} key={review.id}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <b>{review.user.name}</b>
                        {enrolledReviewers.has(review.userId) && <p className="mt-1 text-[12px] font-bold text-emerald-200">{copy.verifiedBuyer}</p>}
                      </div>
                      <span className="text-[13px] font-bold text-violet-200">{review.rating}/5</span>
                    </div>
                    <p className="mt-3 text-[15px] leading-6 text-slate-200">{review.comment}</p>
                  </article>
                ))
              ) : (
                <p className="mt-4 text-[15px] text-slate-400">{copy.noReviews}</p>
              )}
              {canReviewCourse ? (
                <form className={`mt-6 grid gap-3 border-t ${border} pt-5`} action="/api/reviews" method="post">
                  <CsrfInput />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="redirect" value={`/courses/${course.slug}`} />
                  <select className={inputClass} name="rating" defaultValue="5" aria-label={copy.ratingLabel}>
                    <option value="5">5 {copy.starsLabel}</option>
                    <option value="4">4 {copy.starsLabel}</option>
                    <option value="3">3 {copy.starsLabel}</option>
                    <option value="2">2 {copy.starsLabel}</option>
                    <option value="1">1 {copy.starsLabel}</option>
                  </select>
                  <textarea className="moe-control min-h-24 w-full px-5 py-4 text-[15px] font-semibold text-white" name="comment" placeholder={copy.shareReview} />
                  <button className="moe-primary inline-flex h-11 items-center justify-center rounded-lg px-5 text-[15px] font-black transition">{copy.postReview}</button>
                </form>
              ) : (
                <div className={`mt-6 border-t ${border} pt-5`}>
                  <p className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-slate-300">
                    Reviews unlock after you start learning and reach at least 20% course progress.
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-8 sm:px-8" id="questions">
              <h2 className="text-2xl font-extrabold">{copy.questions}</h2>
              {course.questions.length ? (
                course.questions.map((question) => (
                  <article className={`border-t ${border} py-5 first:mt-4 first:border-t-0`} key={question.id}>
                    <b>{question.title}</b>
                    <p className="mt-3 text-[15px] leading-6 text-slate-300">{question.body}</p>
                    {question.answer && <p className="mt-3 border-l-2 border-violet-300/70 pl-4 text-[15px] leading-6 text-slate-300">{question.answer}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={`/api/questions/${question.id}/like`} method="post">
                        <CsrfInput />
                        <input type="hidden" name="redirect" value={`/courses/${course.slug}`} />
                        <button className="moe-control inline-flex h-9 items-center gap-2 px-3 text-[13px] font-bold text-slate-300 transition hover:bg-white/10">
                          <ThumbsUp size={15} strokeWidth={1.8} />
                          {copy.helpful}{question.helpfulCount ? ` (${question.helpfulCount})` : ''}
                        </button>
                      </form>
                      <form action={`/api/questions/${question.id}/report`} method="post" className="inline-flex gap-2">
                        <CsrfInput />
                        <input type="hidden" name="redirect" value={`/courses/${course.slug}`} />
                        <input type="hidden" name="reason" value={copy.reportReason} />
                        <button className="moe-control inline-flex h-9 items-center gap-2 px-3 text-[13px] font-bold text-slate-300 transition hover:bg-white/10">
                          <Flag size={15} strokeWidth={1.8} />
                          {copy.report}
                        </button>
                      </form>
                    </div>
                  </article>
                ))
              ) : (
                <p className="mt-4 text-[15px] text-slate-400">{copy.noQuestions}</p>
              )}
              {canPostBuyerContent ? (
                <form className={`mt-6 grid gap-3 border-t ${border} pt-5`} action="/api/questions" method="post">
                  <CsrfInput />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="redirect" value={`/courses/${course.slug}`} />
                  <input className={inputClass} name="title" placeholder={copy.questionTitle} required />
                  <textarea className="moe-control min-h-24 w-full px-5 py-4 text-[15px] font-semibold text-white" name="body" placeholder={copy.askInstructor} required />
                  <button className="moe-primary inline-flex h-11 items-center justify-center rounded-lg px-5 text-[15px] font-black transition">{copy.askQuestion}</button>
                </form>
              ) : (
                <div className={`mt-6 border-t ${border} pt-5`}>
                  <p className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-slate-300">
                    Course questions are available after enrolling in this course with a student account.
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="hidden lg:block">
          <div className="moe-panel sticky top-6 rounded-xl p-6" id="enroll">
            <div className={`border-b ${border} pb-6`}>
              <p className={metricText}>{copy.enrollment}</p>
              <p className="mt-2 text-5xl font-extrabold tracking-[-0.02em]">
                {course.isFree ? copy.free : formatMoney(couponPreviewTotal, settings.currency)}
              </p>
              {validRequestedCoupon && validRequestedCoupon.discount > 0 && !course.isFree && (
                <p className="mt-2 text-[13px] font-bold text-slate-400">
                  {formatMoney(price, settings.currency)} - {formatMoney(validRequestedCoupon.discount, settings.currency)}
                </p>
              )}
              {requestedCoupon && requestedCouponResult && (
                <p
                  className={`mt-4 rounded-lg border px-4 py-2 text-[13px] font-bold ${
                    requestedCouponResult.valid
                      ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                      : 'border-red-300/30 bg-red-400/10 text-red-100'
                  }`}
                >
                  {requestedCouponResult.valid
                    ? `${copy.couponReady}: ${requestedCoupon}`
                    : `${copy.couponCode} ${requestedCoupon}: ${requestedCouponResult.reason || 'Invalid coupon.'}`}
                </p>
              )}
            </div>

            <form action="/api/checkout" method="post" className={`grid gap-3 border-b ${border} py-6`}>
              <CsrfInput />
              <input type="hidden" name="courseId" value={course.id} />
              <input className={inputClass} name="couponCode" defaultValue={requestedCouponResult?.valid ? requestedCoupon : ''} placeholder={copy.couponCode} />
              <select className={inputClass} name="gateway">
                {paymentMethods.map((method: any) => (
                  <option key={method.slug} value={method.slug}>
                    {gatewayLabels[method.slug] || method.name}
                  </option>
                ))}
              </select>
              <button className="moe-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-[15px] font-black transition">
                {copy.enrollBuy}
                <ArrowRight size={18} strokeWidth={1.8} />
              </button>
            </form>

            {activeCoupons.length > 0 && (
              <div className={`border-b ${border} py-6`}>
                <div className="flex items-center gap-2">
                  <BadgePercent className="text-emerald-200" size={18} strokeWidth={1.8} />
                  <p className="text-[15px] font-bold">{copy.activeCoupons}</p>
                </div>
                <div className="mt-4 grid gap-3">
                  {activeCoupons.map((coupon) => (
                    <div className="moe-panel-soft rounded-lg p-3" key={coupon.id}>
                      <div className="flex items-center justify-between gap-3">
                        <b>{coupon.code}</b>
                        <span className="text-[13px] font-bold text-emerald-200">{couponLabel(coupon, settings.currency)} {copy.off}</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-5 text-slate-400">
                        {copy.couponApplies} {coupon.expiresAt ? `${copy.until} ${coupon.expiresAt.toLocaleDateString()}` : copy.noExpiry}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form action="/api/cart/add" method="post" className="pt-4">
              <CsrfInput />
              <input type="hidden" name="courseId" value={course.id} />
              <button className="moe-control inline-flex h-12 w-full items-center justify-center gap-2 px-6 text-[15px] font-black text-white transition hover:bg-white/10">
                <ShoppingCart size={18} strokeWidth={1.8} />
                {copy.addToCart}
              </button>
            </form>
            <form action="/api/favorites/toggle" method="post" className="mt-3">
              <CsrfInput />
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="redirect" value={`/courses/${course.slug}`} />
              <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-[15px] font-black text-white transition hover:bg-white/10">
                <Heart size={18} strokeWidth={1.8} />
                {isFavorited ? 'Saved to favorites' : copy.saveFavorite}
              </button>
            </form>

            <div className={`mt-6 grid gap-4 border-t ${border} pt-6 text-[15px]`}>
              <p className="flex items-center justify-between gap-4">
                <span className="text-slate-400">{copy.instructor}</span>
                <b>{course.instructor.name}</b>
              </p>
              <p className="flex items-center justify-between gap-4">
                <span className="text-slate-400">{copy.language}</span>
                <b>{course.language}</b>
              </p>
              <p className="flex items-center justify-between gap-4">
                <span className="text-slate-400">{copy.questions}</span>
                <b className="inline-flex items-center gap-1">
                  <MessageCircle size={15} strokeWidth={1.8} />
                  {course._count.questions}
                </b>
              </p>
              <p className="flex items-center justify-between gap-4">
                <span className="text-slate-400">{copy.certificate}</span>
                <b>{course.includesCertificate ? copy.included : copy.notIncluded}</b>
              </p>
            </div>
          </div>
        </aside>

        <section className="moe-sidebar fixed inset-x-0 bottom-0 border-t p-4 lg:hidden" aria-label={copy.enrollment}>
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={metricText}>{copy.enrollment}</p>
              <p className="truncate text-2xl font-extrabold">{course.isFree ? copy.free : formatMoney(couponPreviewTotal, settings.currency)}</p>
            </div>
            <form action="/api/checkout" method="post" className="flex items-center gap-2">
              <CsrfInput />
              <input type="hidden" name="courseId" value={course.id} />
              {requestedCouponResult?.valid && <input type="hidden" name="couponCode" value={requestedCoupon} />}
              <select className="moe-control h-11 max-w-32 px-3 text-[13px] font-bold text-white" name="gateway" aria-label="Payment method">
                {paymentMethods.map((method: any) => (
                  <option key={method.slug} value={method.slug}>
                    {gatewayLabels[method.slug] || method.name}
                  </option>
                ))}
              </select>
              <button className="moe-primary inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[15px] font-black transition">
                {copy.enroll}
                <ArrowRight size={17} strokeWidth={1.8} />
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
