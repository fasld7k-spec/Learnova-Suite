import Link from 'next/link';
import { Activity, BarChart3, Eye, Heart, MessageCircle, MousePointerClick, Star, UsersRound } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

const money = (value: unknown) => Number(value || 0);
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

function percent(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function safeRate(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function addCount(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function lastDays(count: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return dayKey(date);
  });
}

function uniqueViewKey(view: { id: string; userId: string | null; ip: string | null }) {
  if (view.userId) return `user:${view.userId}`;
  if (view.ip) return `ip:${view.ip}`;
  return `view:${view.id}`;
}

function MiniBarSeries({ rows }: { rows: { label: string; views: number; enrollments: number; sales: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.views, row.enrollments, row.sales)));
  const barHeight = (value: number) => (value > 0 ? `${Math.max(4, (value / max) * 100)}%` : '0%');

  return (
    <div className="border border-[#2F3336] bg-black p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Last 14 days</h2>
          <p className="mt-1 text-sm font-semibold text-[#71767B]">Views, enrollments, and paid sales activity.</p>
        </div>
        <BarChart3 size={22} className="text-[#1D9BF0]" />
      </div>
      <div className="mt-6 flex items-end gap-2 overflow-x-auto pb-2">
        {rows.map((row) => (
          <div className="grid min-w-10 gap-1" key={row.label} title={`${row.label}: ${row.views} views, ${row.enrollments} enrollments, ${row.sales} sales`}>
            <div className="flex h-32 items-end gap-1">
              <span className="w-2 rounded-t-full bg-[#1D9BF0]" style={{ height: barHeight(row.views) }} />
              <span className="w-2 rounded-t-full bg-[#00BA7C]" style={{ height: barHeight(row.enrollments) }} />
              <span className="w-2 rounded-t-full bg-[#FFD400]" style={{ height: barHeight(row.sales) }} />
            </div>
            <span className="text-[10px] font-bold text-[#71767B]">{row.label.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-[#71767B]">
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#1D9BF0]" /> Views</span>
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#00BA7C]" /> Enrollments</span>
        <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#FFD400]" /> Paid sales</span>
      </div>
    </div>
  );
}

function FunnelStep({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const width = value > 0 ? `${Math.max(2, safeRate(value, max))}%` : '0%';
  return (
    <div className="border-b border-[#2F3336] py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4 text-sm font-bold">
        <span className="text-[#E7E9EA]">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#16181C]">
        <div className={`h-full rounded-full ${tone}`} style={{ width }} />
      </div>
    </div>
  );
}

export default async function InstructorAnalytics() {
  const user = await requireUser(['INSTRUCTOR']);
  const settingsPromise = getSiteSettings();
  const courses = await prisma.course.findMany({
    where: { instructorId: user.id },
    include: {
      category: true,
      enrollments: true,
      reviews: true,
      questions: true,
      modules: { include: { lessons: { select: { id: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });
  const courseIds = courses.map((course) => course.id);
  const lessonIds = courses.flatMap((course) => course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));

  const [
    settings,
    views,
    favorites,
    waitlists,
    paidItems,
    progressRows,
    resources,
    liveSessions,
    quizzes,
    assignments,
    bookings
  ] = await Promise.all([
    settingsPromise,
    courseIds.length ? prisma.courseView.findMany({ where: { courseId: { in: courseIds } }, orderBy: { createdAt: 'desc' }, take: 5000 }) : Promise.resolve([]),
    courseIds.length ? prisma.favorite.findMany({ where: { courseId: { in: courseIds } }, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
    courseIds.length ? prisma.courseWaitlist.findMany({ where: { courseId: { in: courseIds } }, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
    courseIds.length
      ? prisma.orderItem.findMany({
          where: { courseId: { in: courseIds }, order: { status: 'PAID' } },
          include: { order: { select: { createdAt: true, userId: true } } },
          orderBy: { order: { createdAt: 'desc' } }
        })
      : Promise.resolve([]),
    lessonIds.length
      ? prisma.lessonProgress.findMany({
          where: { lessonId: { in: lessonIds }, completed: true },
          include: { lesson: { select: { module: { select: { courseId: true } } } } },
          orderBy: { updatedAt: 'desc' },
          take: 5000
        })
      : Promise.resolve([]),
    courseIds.length ? prisma.courseResource.findMany({ where: { courseId: { in: courseIds } } }) : Promise.resolve([]),
    prisma.liveSession.findMany({ where: { instructorId: user.id }, orderBy: { startsAt: 'desc' } }),
    lessonIds.length ? prisma.quiz.findMany({ where: { lessonId: { in: lessonIds } } }) : Promise.resolve([]),
    courseIds.length ? prisma.assignment.findMany({ where: { courseId: { in: courseIds } } }) : Promise.resolve([]),
    prisma.booking.findMany({ where: { instructorId: user.id }, orderBy: { createdAt: 'desc' } })
  ]);

  const courseTitle = new Map(courses.map((course) => [course.id, course.title]));
  const courseLessons = new Map(courses.map((course) => [course.id, course.modules.reduce((sum, module) => sum + module.lessons.length, 0)]));
  const viewsByCourse = new Map<string, number>();
  const uniqueViewsByCourse = new Map<string, Set<string>>();
  const favoritesByCourse = new Map<string, number>();
  const waitlistsByCourse = new Map<string, number>();
  const paidSalesByCourse = new Map<string, number>();
  const revenueByCourse = new Map<string, number>();
  const earningsByCourse = new Map<string, number>();
  const completedLessonsByCourse = new Map<string, number>();

  for (const view of views) {
    addCount(viewsByCourse, view.courseId);
    const uniqueSet = uniqueViewsByCourse.get(view.courseId) || new Set<string>();
    uniqueSet.add(uniqueViewKey(view));
    uniqueViewsByCourse.set(view.courseId, uniqueSet);
  }
  for (const favorite of favorites) addCount(favoritesByCourse, favorite.courseId);
  for (const waitlist of waitlists) addCount(waitlistsByCourse, waitlist.courseId);
  for (const item of paidItems) {
    addCount(paidSalesByCourse, item.courseId);
    addCount(revenueByCourse, item.courseId, money(item.price));
    addCount(earningsByCourse, item.courseId, money(item.instructorEarning));
  }
  for (const progress of progressRows) {
    addCount(completedLessonsByCourse, progress.lesson.module.courseId);
  }

  const totalViews = views.length;
  const totalUniqueVisitors = new Set(views.map(uniqueViewKey)).size;
  const totalFavorites = favorites.length;
  const totalWaitlists = waitlists.length;
  const totalQuestions = courses.reduce((sum, course) => sum + course.questions.length, 0);
  const interestedSignals = totalFavorites + totalWaitlists + totalQuestions;
  const totalEnrollments = courses.reduce((sum, course) => sum + course.enrollments.length, 0);
  const paidSales = paidItems.length;
  const totalRevenue = paidItems.reduce((sum, item) => sum + money(item.price), 0);
  const totalEarnings = paidItems.reduce((sum, item) => sum + money(item.instructorEarning), 0);
  const completedEnrollments = courses.reduce((sum, course) => sum + course.enrollments.filter((enrollment) => enrollment.completedAt).length, 0);
  const allReviews = courses.flatMap((course) => course.reviews);
  const avgRating = allReviews.length ? Math.round((allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length) * 10) / 10 : 0;
  const conversionRate = percent(totalEnrollments, Math.max(totalUniqueVisitors, totalViews));

  const seriesDays = lastDays(14);
  const viewsByDay = new Map<string, number>();
  const enrollmentsByDay = new Map<string, number>();
  const salesByDay = new Map<string, number>();
  for (const view of views) addCount(viewsByDay, dayKey(view.createdAt));
  for (const course of courses) {
    for (const enrollment of course.enrollments) addCount(enrollmentsByDay, dayKey(enrollment.createdAt));
  }
  for (const item of paidItems) addCount(salesByDay, dayKey(item.order.createdAt));
  const activitySeries = seriesDays.map((label) => ({
    label,
    views: viewsByDay.get(label) || 0,
    enrollments: enrollmentsByDay.get(label) || 0,
    sales: salesByDay.get(label) || 0
  }));

  const courseRows = courses
    .map((course) => {
      const viewsCount = viewsByCourse.get(course.id) || 0;
      const uniqueVisitors = uniqueViewsByCourse.get(course.id)?.size || 0;
      const favoriteCount = favoritesByCourse.get(course.id) || 0;
      const waitlistCount = waitlistsByCourse.get(course.id) || 0;
      const questionCount = course.questions.length;
      const interested = favoriteCount + waitlistCount + questionCount;
      const enrollments = course.enrollments.length;
      const lessonCount = courseLessons.get(course.id) || 0;
      const possibleLessons = Math.max(1, lessonCount * Math.max(1, enrollments));
      const completion = enrollments ? Math.round(((completedLessonsByCourse.get(course.id) || 0) / possibleLessons) * 100) : 0;
      const reviews = course.reviews.length;
      const rating = reviews ? Math.round((course.reviews.reduce((sum, review) => sum + review.rating, 0) / reviews) * 10) / 10 : 0;
      return {
        course,
        views: viewsCount,
        uniqueVisitors,
        interested,
        enrollments,
        sales: paidSalesByCourse.get(course.id) || 0,
        revenue: revenueByCourse.get(course.id) || 0,
        earnings: earningsByCourse.get(course.id) || 0,
        completion,
        rating,
        conversion: safeRate(enrollments, Math.max(uniqueVisitors, viewsCount))
      };
    })
    .sort((a, b) => b.views - a.views || b.interested - a.interested || b.revenue - a.revenue);

  const recentInterested = [
    ...favorites.slice(0, 12).map((row) => ({ type: 'Favorite', courseId: row.courseId, identity: row.userId, date: row.createdAt })),
    ...waitlists.slice(0, 12).map((row) => ({ type: 'Waitlist', courseId: row.courseId, identity: row.email, date: row.createdAt })),
    ...courses.flatMap((course) => course.questions.map((question) => ({ type: 'Question', courseId: course.id, identity: question.title, date: question.createdAt }))).slice(0, 12)
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

  const maxFunnel = Math.max(1, totalViews, interestedSignals, totalEnrollments, paidSales, completedEnrollments);

  return (
    <DashboardShell role="instructor" title="Instructor Analytics">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Course visits" value={totalViews} />
        <StatCard label="Unique visitors" value={totalUniqueVisitors} />
        <StatCard label="Interested signals" value={interestedSignals} />
        <StatCard label="Visit to enrollment" value={conversionRate} />
        <StatCard label="Students" value={totalEnrollments} />
        <StatCard label="Paid sales" value={paidSales} />
        <StatCard label="Revenue" value={formatMoney(totalRevenue, settings.currency)} />
        <StatCard label="Instructor earnings" value={formatMoney(totalEarnings, settings.currency)} />
      </div>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <MiniBarSeries rows={activitySeries} />
        <div className="border border-[#2F3336] bg-black p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white">Course funnel</h2>
              <p className="mt-1 text-sm font-semibold text-[#71767B]">From visits to completed learners.</p>
            </div>
            <Activity size={22} className="text-[#1D9BF0]" />
          </div>
          <div className="mt-5">
            <FunnelStep label="Visits" value={totalViews} max={maxFunnel} tone="bg-[#1D9BF0]" />
            <FunnelStep label="Interested" value={interestedSignals} max={maxFunnel} tone="bg-[#7856FF]" />
            <FunnelStep label="Enrollments" value={totalEnrollments} max={maxFunnel} tone="bg-[#00BA7C]" />
            <FunnelStep label="Paid sales" value={paidSales} max={maxFunnel} tone="bg-[#FFD400]" />
            <FunnelStep label="Completed" value={completedEnrollments} max={maxFunnel} tone="bg-[#F91880]" />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border-b border-[#2F3336] bg-black p-5">
          <Eye className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-2xl font-black text-white">{totalViews}</p>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Total course page visits</p>
        </div>
        <div className="border-b border-[#2F3336] bg-black p-5">
          <Heart className="text-[#F91880]" size={22} />
          <p className="mt-4 text-2xl font-black text-white">{totalFavorites}</p>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Favorites saved by learners</p>
        </div>
        <div className="border-b border-[#2F3336] bg-black p-5">
          <MessageCircle className="text-[#00BA7C]" size={22} />
          <p className="mt-4 text-2xl font-black text-white">{totalQuestions}</p>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Course questions</p>
        </div>
        <div className="border-b border-[#2F3336] bg-black p-5">
          <Star className="text-[#FFD400]" size={22} />
          <p className="mt-4 text-2xl font-black text-white">{avgRating || '-'}</p>
          <p className="mt-1 text-sm font-medium text-[#71767B]">Average rating</p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Course performance</h2>
            <p className="mt-1 text-sm font-semibold text-[#71767B]">Visits, interested learners, sales, earnings, completion, and reviews by course.</p>
          </div>
          <Link className="btn-primary" href="/instructor/courses">
            Manage courses
          </Link>
        </div>
        <DataTable
          headers={['Course', 'Status', 'Visits', 'Interested', 'Enrollments', 'Sales', 'Revenue', 'Completion', 'Rating']}
          rows={courseRows.map((row) => [
            <div key="course" className="min-w-64">
              <Link className="font-black text-white hover:text-[#1D9BF0]" href={`/instructor/courses/${row.course.id}`}>{row.course.title}</Link>
              <p className="mt-1 text-xs font-semibold text-[#71767B]">{row.uniqueVisitors} unique / {row.conversion}% conversion</p>
            </div>,
            <Badge key="status" tone={row.course.status === 'PUBLISHED' ? 'green' : row.course.status === 'PENDING' ? 'yellow' : 'slate'}>{row.course.status}</Badge>,
            row.views,
            row.interested,
            row.enrollments,
            row.sales,
            formatMoney(row.revenue, settings.currency),
            `${row.completion}%`,
            row.rating || '-'
          ])}
        />
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-black text-white">Recent interested learners</h2>
          <DataTable
            headers={['Signal', 'Course', 'Identity', 'Date']}
            rows={recentInterested.map((row) => [
              <Badge key="type" tone={row.type === 'Favorite' ? 'red' : row.type === 'Waitlist' ? 'blue' : 'green'}>{row.type}</Badge>,
              courseTitle.get(row.courseId) || row.courseId,
              <span key="identity" className="break-all">{row.identity}</span>,
              row.date.toISOString().slice(0, 10)
            ])}
          />
        </div>

        <div className="border border-[#2F3336] bg-black p-5">
          <h2 className="text-xl font-black text-white">Teaching assets</h2>
          <p className="mt-1 text-sm font-semibold text-[#71767B]">Operational indicators that affect learner engagement.</p>
          <div className="mt-5 grid gap-3">
            {[
              ['Courses', courses.length, UsersRound],
              ['Resources', resources.length, MousePointerClick],
              ['Quizzes', quizzes.length, BarChart3],
              ['Assignments', assignments.length, Activity],
              ['Live sessions', liveSessions.length, Eye],
              ['Bookings', bookings.length, UsersRound]
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as typeof UsersRound;
              return (
                <div className="flex items-center justify-between border-b border-[#2F3336] pb-3 last:border-b-0 last:pb-0" key={String(label)}>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                    <MetricIcon size={16} className="text-[#1D9BF0]" />
                    {String(label)}
                  </span>
                  <b className="text-white">{String(value)}</b>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
