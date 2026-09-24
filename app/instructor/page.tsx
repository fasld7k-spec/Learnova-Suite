/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Star,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

const money = (value: unknown) => Number(value || 0);

type DashboardCourse = Prisma.CourseGetPayload<{
  include: {
    enrollments: true;
    reviews: true;
    modules: { include: { lessons: true } };
  };
}>;

function percent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(value % 1 ? 1 : 0)}%`;
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IN';
}

function chartPath(values: number[], width = 560, height = 170) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 22) - 10;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function ratioDelta(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function buildMonthSeries(items: { instructorEarning: unknown; order: { createdAt: Date } }[], now = new Date()) {
  const start = startOfMonth(now);
  const end = addMonths(now, 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const bucketCount = 6;
  const values = Array.from({ length: bucketCount }, () => 0);
  const labels = values.map((_, index) => {
    const day = Math.min(daysInMonth, Math.max(1, Math.round(1 + (index * (daysInMonth - 1)) / Math.max(bucketCount - 1, 1))));
    return now.toLocaleString('en-US', { month: 'short' }) + ` ${day}`;
  });

  for (const item of items) {
    const createdAt = item.order.createdAt;
    if (createdAt < start || createdAt >= end) continue;
    const dayIndex = createdAt.getDate() - 1;
    const bucket = Math.min(bucketCount - 1, Math.floor((dayIndex / daysInMonth) * bucketCount));
    values[bucket] += money(item.instructorEarning);
  }

  return { values, labels };
}

function calendarDays(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const days: { label: string; muted?: boolean; active?: boolean }[] = [];
  const previousMonthDays = new Date(year, month, 0).getDate();
  for (let index = leading - 1; index >= 0; index -= 1) {
    days.push({ label: String(previousMonthDays - index), muted: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({ label: String(day), active: day === date.getDate() });
  }
  let trailingDay = 1;
  while (days.length % 7 !== 0) {
    days.push({ label: String(trailingDay), muted: true });
    trailingDay += 1;
  }
  return days.slice(0, 42);
}

function SidebarLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: LucideIcon; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 min-w-40 items-center gap-3 rounded-xl px-4 text-sm font-bold transition xl:min-w-0 ${
        active
          ? 'teacher-nav-active text-white shadow-[0_16px_35px_rgba(109,40,217,0.32)]'
          : 'teacher-nav-muted text-slate-400 hover:text-white'
      }`}
    >
      <Icon size={18} strokeWidth={1.8} />
      {label}
    </Link>
  );
}

function HeaderIconLink({ href, label, icon: Icon, count }: { href: string; label: string; icon: LucideIcon; count?: number }) {
  return (
    <Link
      href={href}
      className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-700/70 bg-[#0b1323] text-slate-300 transition hover:border-violet-400/50 hover:text-white"
      aria-label={label}
    >
      <Icon size={18} />
      {count ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function MetricCard({ label, value, delta, icon: Icon }: { label: string; value: string | number; delta: string; icon: LucideIcon }) {
  return (
    <article className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-600/25 text-violet-200 ring-1 ring-violet-400/20">
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black leading-none text-white">{value}</p>
        </div>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-400">
        <span className={`font-black ${delta.startsWith('-') ? 'text-rose-300' : 'text-emerald-400'}`}>{delta}</span>
        vs last month
      </p>
    </article>
  );
}

function EarningsChart({ total, currency, values, labels, delta }: { total: number; currency: string; values: number[]; labels: string[]; delta: number }) {
  const path = chartPath(values);
  const fillPath = `${path} L 560 170 L 0 170 Z`;
  const hasValues = values.some((value) => value > 0);

  return (
    <section className="h-[310px] overflow-hidden rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-white">Earnings Overview</h2>
          <p className="mt-4 text-3xl font-black text-white">{formatMoney(total, currency)}</p>
          <p className="mt-2 text-xs font-semibold text-slate-400"><span className={delta < 0 ? 'text-rose-300' : 'text-emerald-400'}>{percent(delta)}</span> vs last month</p>
        </div>
        <span className="rounded-lg border border-slate-700 bg-[#0a1020] px-3 py-2 text-xs font-bold text-white" aria-label="Current chart period">
          This Month
        </span>
      </div>
      <div className="mt-5 overflow-hidden">
        <svg viewBox="0 0 560 205" className="h-48 w-full" role="img" aria-label="Monthly earnings chart">
          <defs>
            <linearGradient id="earningsFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7c3cff" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#7c3cff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line key={line} x1="0" x2="560" y1={35 + line * 38} y2={35 + line * 38} stroke="#253148" strokeWidth="1" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((line) => (
            <line key={line} x1={line * 112} x2={line * 112} y1="12" y2="170" stroke="#1f2a3d" strokeWidth="1" />
          ))}
          {hasValues ? <path d={fillPath} fill="url(#earningsFill)" /> : null}
          <path d={hasValues ? path : 'M 0 145 L 560 145'} fill="none" stroke="#8b5cf6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" opacity={hasValues ? 1 : 0.45} />
          {values.map((value, index) => {
            const max = Math.max(...values);
            const min = Math.min(...values);
            const x = (index / (values.length - 1)) * 560;
            const y = 170 - ((value - min) / Math.max(max - min, 1)) * 138 - 10;
            return hasValues ? <circle key={index} cx={x} cy={y} r="3.5" fill="#a78bfa" /> : null;
          })}
          {labels.map((label, index) => {
            const isLast = index === labels.length - 1;
            return (
              <text key={label} x={isLast ? 548 : index * 104 + 3} y="198" fill="#cbd5e1" fontSize="12" textAnchor={isLast ? 'end' : 'start'}>
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function StudentDonut({ total, newStudents, completedStudents }: { total: number; newStudents: number; completedStudents: number }) {
  const active = Math.max(total - completedStudents, 0);
  const inactive = Math.max(completedStudents, 0);
  const newShare = total ? Math.round((newStudents / total) * 100) : 0;
  const activeShare = total ? Math.round((active / total) * 100) : 0;
  const inactiveShare = Math.max(0, 100 - newShare - activeShare);
  return (
    <section className="h-[310px] overflow-hidden rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
      <h2 className="text-base font-black text-white">Students Overview</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-[190px_1fr] md:items-center">
        <div
          className="relative mx-auto h-44 w-44 rounded-full p-6 shadow-[0_0_60px_rgba(59,130,246,0.16)]"
          style={{ background: `conic-gradient(#6d35e8 0 ${newShare}%, #3498ef ${newShare}% ${newShare + activeShare}%, #d7a52a ${newShare + activeShare}% 100%)` }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-[#0b1323] text-center ring-1 ring-slate-700/40">
            <div>
              <p className="text-3xl font-black text-white">{compact(total)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-400">Total Students</p>
            </div>
          </div>
        </div>
        <div className="grid gap-5 text-sm">
          {[
            ['New Students', newStudents, `${newShare}%`, '#7c3cff'],
            ['Active Students', active, `${activeShare}%`, '#3498ef'],
            ['Completed Students', inactive, `${inactiveShare}%`, '#d7a52a'],
          ].map(([label, value, share, color]) => (
            <div key={String(label)} className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: String(color) }} />
              <div>
                <p className="text-slate-400">{label}</p>
                <p className="mt-1 font-black text-white">{compact(Number(value))} ({share})</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CalendarPanel({ events }: { events: { tone: 'red' | 'violet' | 'blue'; title: string; meta: string; time: string }[] }) {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-white">Calendar</h2>
        <div className="flex gap-2 text-slate-400" aria-hidden="true">
          <ChevronLeft size={17} />
          <ChevronRight size={17} />
        </div>
      </div>
      <p className="mt-5 text-center text-sm font-bold text-slate-300">{month}</p>
      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="text-slate-500">{day}</span>)}
        {calendarDays(now).map((day, index) => (
          <span key={`${day.label}-${index}`} className={`grid h-8 place-items-center rounded-full font-semibold ${day.active ? 'bg-violet-600 text-white' : day.muted ? 'text-slate-600' : 'text-slate-300'}`}>
            {day.label}
          </span>
        ))}
      </div>
      <div className="mt-5 grid gap-4 border-t border-slate-700/50 pt-5">
        {events.length ? (
          events.map((event) => <EventItem key={`${event.title}-${event.time}`} {...event} />)
        ) : (
          <p className="text-sm font-semibold text-slate-400">No scheduled teaching events yet.</p>
        )}
      </div>
    </section>
  );
}

function EventItem({ tone, title, meta, time }: { tone: 'red' | 'violet' | 'blue'; title: string; meta: string; time: string }) {
  const colors = {
    red: 'bg-rose-500/15 text-rose-300',
    violet: 'bg-violet-500/15 text-violet-300',
    blue: 'bg-blue-500/15 text-blue-300',
  };
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${colors[tone]}`}>
        <CalendarDays size={14} />
      </span>
      <div>
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">{meta}</p>
        <p className="mt-1 text-xs text-slate-500">{time}</p>
      </div>
    </div>
  );
}

function CourseRow({ course, currency }: { course: DashboardCourse; currency: string }) {
  const lessons = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const revenue = course.enrollments.length * money(course.salePrice ?? course.price);
  const rating = course.reviews.length
    ? course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length
    : 0;

  return (
    <article className="grid gap-4 border-t border-slate-700/45 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_92px_108px_86px_36px] md:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="teacher-course-thumb grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-700/60">
          {course.coverImage ? (
            <img src={course.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <BookOpen className="text-violet-200" size={34} />
          )}
        </div>
        <div className="min-w-0">
          <div className="grid min-w-0 gap-2 sm:flex sm:items-center">
            <h3 className="min-w-0 line-clamp-2 text-base font-black leading-5 text-white sm:truncate">{course.title}</h3>
            <span className="w-fit shrink-0 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-300">{course.status === 'PUBLISHED' ? 'Published' : course.status}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-400">{course.modules.length} Sections / {lessons} Lessons</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 md:contents">
        <MiniDatum label="Students" value={compact(course.enrollments.length)} />
        <MiniDatum label="Revenue" value={formatMoney(revenue, currency)} />
        <MiniDatum label="Rating" value={course.reviews.length ? rating.toFixed(1) : 'N/A'} gold />
      </div>
      <Link href={`/instructor/courses/${course.id}`} className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-slate-300 transition hover:bg-violet-500/20 hover:text-white max-md:justify-self-end" aria-label={`Manage ${course.title}`}>
        <MoreHorizontal size={17} />
      </Link>
    </article>
  );
}

function MiniDatum({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-black ${gold ? 'text-amber-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export default async function Instructor() {
  const user = await requireUser(['INSTRUCTOR']);
  const [settings, courses] = await Promise.all([
    getSiteSettings(),
    prisma.course.findMany({
      where: { instructorId: user.id },
      include: {
        enrollments: true,
        reviews: true,
        modules: { include: { lessons: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const courseIds = courses.map((course) => course.id);
  const lessonIds = courses.flatMap((course) => course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
  const [earningItems, withdrawals, openQuestions, courseViews, assignments, quizCount, liveSessions, notifications] = await Promise.all([
    courseIds.length
      ? prisma.orderItem.findMany({
          where: { courseId: { in: courseIds }, order: { status: 'PAID' } },
          include: { order: { select: { createdAt: true } } },
          orderBy: { order: { createdAt: 'desc' } },
          take: 500,
        })
      : Promise.resolve([]),
    prisma.withdrawal.findMany({ where: { instructorId: user.id } }),
    courseIds.length ? prisma.question.count({ where: { courseId: { in: courseIds }, answer: null } }) : Promise.resolve(0),
    courseIds.length ? prisma.courseView.count({ where: { courseId: { in: courseIds } } }) : Promise.resolve(0),
    courseIds.length ? prisma.assignment.findMany({ where: { courseId: { in: courseIds } }, orderBy: { dueAt: 'asc' }, take: 5 }) : Promise.resolve([]),
    lessonIds.length ? prisma.quiz.count({ where: { lessonId: { in: lessonIds } } }) : Promise.resolve(0),
    prisma.liveSession.findMany({ where: { instructorId: user.id }, orderBy: { startsAt: 'asc' }, take: 4 }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 3 }),
  ]);

  const totalEarnings = earningItems.reduce((sum, item) => sum + money(item.instructorEarning), 0);
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = addMonths(now, 1);
  const previousMonthStart = addMonths(now, -1);
  const thisMonthEarnings = earningItems
    .filter((item) => item.order.createdAt >= thisMonthStart && item.order.createdAt < nextMonthStart)
    .reduce((sum, item) => sum + money(item.instructorEarning), 0);
  const previousMonthEarnings = earningItems
    .filter((item) => item.order.createdAt >= previousMonthStart && item.order.createdAt < thisMonthStart)
    .reduce((sum, item) => sum + money(item.instructorEarning), 0);
  const monthSeries = buildMonthSeries(earningItems, now);
  const paidOut = withdrawals
    .filter((withdrawal) => withdrawal.status === 'APPROVED' || withdrawal.status === 'PAID')
    .reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0);
  const pending = withdrawals
    .filter((withdrawal) => withdrawal.status === 'PENDING')
    .reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0);
  const available = Math.max(totalEarnings - paidOut - pending, 0);
  const totalStudents = courses.reduce((sum, course) => sum + course.enrollments.length, 0);
  const thisMonthStudents = courses.reduce(
    (sum, course) => sum + course.enrollments.filter((enrollment) => enrollment.createdAt >= thisMonthStart && enrollment.createdAt < nextMonthStart).length,
    0,
  );
  const previousMonthStudents = courses.reduce(
    (sum, course) => sum + course.enrollments.filter((enrollment) => enrollment.createdAt >= previousMonthStart && enrollment.createdAt < thisMonthStart).length,
    0,
  );
  const completedStudents = courses.reduce((sum, course) => sum + course.enrollments.filter((enrollment) => Boolean(enrollment.completedAt)).length, 0);
  const watchHours = Math.round(courses.reduce((sum, course) => sum + course.durationMinutes * course.enrollments.length, 0) / 60);
  const allReviews = courses.flatMap((course) => course.reviews);
  const avgRating = allReviews.length ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length : 0;
  const thisMonthCourseCount = courses.filter((course) => course.createdAt >= thisMonthStart && course.createdAt < nextMonthStart).length;
  const previousMonthCourseCount = courses.filter((course) => course.createdAt >= previousMonthStart && course.createdAt < thisMonthStart).length;
  const thisMonthReviews = allReviews.filter((review) => review.createdAt >= thisMonthStart && review.createdAt < nextMonthStart);
  const previousMonthReviews = allReviews.filter((review) => review.createdAt >= previousMonthStart && review.createdAt < thisMonthStart);
  const thisMonthRating = thisMonthReviews.length ? thisMonthReviews.reduce((sum, review) => sum + review.rating, 0) / thisMonthReviews.length : avgRating;
  const previousMonthRating = previousMonthReviews.length ? previousMonthReviews.reduce((sum, review) => sum + review.rating, 0) / previousMonthReviews.length : thisMonthRating;
  const displayName = settings.siteName;
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const upcomingLive = liveSessions.find((session) => session.startsAt >= new Date()) || liveSessions[0];
  const calendarEvents = [
    upcomingLive
      ? {
          tone: 'red' as const,
          title: 'Live Session',
          meta: upcomingLive.title,
          time: upcomingLive.startsAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        }
      : null,
    assignments[0]
      ? {
          tone: 'violet' as const,
          title: 'Assignment Due',
          meta: assignments[0].title,
          time: assignments[0].dueAt ? assignments[0].dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date',
        }
      : null,
    openQuestions
      ? {
          tone: 'blue' as const,
          title: 'Open Questions',
          meta: `${openQuestions} student question${openQuestions === 1 ? '' : 's'} waiting`,
          time: 'Needs reply',
        }
      : null,
  ].filter((event): event is { tone: 'red' | 'violet' | 'blue'; title: string; meta: string; time: string } => Boolean(event));
  const tasks = [
    assignments[0] ? { title: `Grade ${assignments[0].title}`, due: assignments[0].dueAt ? assignments[0].dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Due soon' } : null,
    { title: `Review ${openQuestions || 0} student questions`, due: openQuestions ? 'Due today' : 'All clear' },
    upcomingLive ? { title: `Prepare ${upcomingLive.title}`, due: upcomingLive.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : null,
  ].filter((task): task is { title: string; due: string } => Boolean(task));

  return (
    <main className="moe-instructor-redesign min-h-screen bg-[#050a16] text-white">
      <div className="grid min-h-screen w-full max-w-full overflow-x-hidden xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden border-b border-slate-800/80 bg-[#071021] p-5 xl:sticky xl:top-0 xl:h-screen xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="teacher-brand-mark grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-[0_0_36px_rgba(124,60,255,0.38)]">
                <GraduationCap size={22} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xl font-black">{displayName}</span>
                <span className="text-sm font-semibold text-violet-300">Teacher</span>
              </span>
            </Link>
            <Link href="/instructor/notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-700/70 text-slate-300">
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[11px] font-black">{notifications.length}</span>
            </Link>
          </div>

          <nav className="scrollbar-none mt-6 flex w-full gap-2 overflow-x-auto pb-2 xl:mt-8 xl:grid xl:overflow-visible xl:pb-0" aria-label="Instructor dashboard navigation">
            <SidebarLink active href="/instructor" icon={LayoutDashboard} label="Dashboard" />
            <SidebarLink href="/instructor/courses" icon={BookOpen} label="My Courses" />
            <SidebarLink href="/instructor/students" icon={UsersRound} label="Students" />
            <SidebarLink href="/instructor/live-sessions" icon={Clock3} label="Lessons" />
            <SidebarLink href="/instructor/assignments" icon={ClipboardList} label="Assignments" />
            <SidebarLink href="/instructor/quizzes" icon={CheckSquare} label="Quizzes" />
            <SidebarLink href="/instructor/questions" icon={MessageCircle} label="Discussions" />
            <SidebarLink href="/instructor/earnings" icon={WalletCards} label="Earnings" />
            <SidebarLink href="/instructor/analytics" icon={BarChart3} label="Analytics" />
            <SidebarLink href="/instructor/reviews" icon={ShieldCheck} label="Reviews" />
          </nav>

          <section className="mt-6 hidden rounded-xl border border-violet-400/20 bg-violet-600/15 p-4 md:block xl:mt-8">
            <h2 className="text-sm font-black">Quick Actions</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold">
              <Link href="/instructor/courses/new" className="flex items-center gap-2 text-slate-200 hover:text-white"><Plus size={15} /> Create New Course</Link>
              <Link href="/instructor/resources" className="flex items-center gap-2 text-slate-200 hover:text-white"><BookOpen size={15} /> Upload Content</Link>
              <Link href="/instructor/quizzes" className="flex items-center gap-2 text-slate-200 hover:text-white"><FileQuestion size={15} /> Create Quiz</Link>
              <Link href="/instructor/live-sessions" className="flex items-center gap-2 text-slate-200 hover:text-white"><CalendarDays size={15} /> Live Session</Link>
            </div>
          </section>

          <div className="mt-6 hidden rounded-xl border border-slate-700/70 bg-[#0b1323] p-4 sm:block xl:mt-8">
            <div className="flex items-center gap-3">
              {user.avatar ? <img src={user.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-sm font-black">{initials(user.name)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black sm:text-sm xl:text-xs">{user.name}</p>
                <p className="text-xs font-semibold text-slate-400">Course Instructor</p>
              </div>
              <form action="/api/auth/logout" method="post">
                <CsrfInput />
                <button className="text-slate-400 hover:text-white" type="submit" aria-label="Log out">
                  <LogOut size={17} />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-5 lg:p-8">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-normal text-white sm:text-4xl">Welcome back, {user.name.split(' ')[0]}! 👋</h1>
              <p className="mt-2 text-base font-semibold text-slate-400">Here&apos;s what&apos;s happening with your teaching today.</p>
              <p className="mt-2 text-sm font-bold text-violet-300">{todayLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden items-center gap-3 sm:flex">
                <HeaderIconLink href="/messages" icon={MessageCircle} label="Messages" />
                <HeaderIconLink href="/instructor/notifications" icon={Bell} label="Notifications" count={notifications.length} />
                <Link href="/profile" className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-slate-700/70 bg-[#0b1323] text-sm font-black text-white" aria-label="Profile">
                  {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initials(user.name)}
                </Link>
              </div>
              <span className="inline-flex h-11 items-center gap-3 rounded-xl border border-slate-700 bg-[#0b1323] px-4 text-sm font-bold text-white" aria-label="Current dashboard period">
                <CalendarDays size={17} />
                This Month
              </span>
              <Link href="/instructor/courses/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-[0_18px_40px_rgba(124,60,255,0.28)] transition hover:bg-violet-500">
                <Plus size={17} />
                New Course
              </Link>
            </div>
          </header>

          {user.status !== 'APPROVED' && (
            <div className="mt-6 rounded-xl border border-amber-300/35 bg-amber-300/10 p-4 text-sm font-bold text-amber-200">
              Your instructor account is waiting admin approval. Course publishing and payout requests unlock after approval.
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={UsersRound} label="Total Students" value={compact(totalStudents)} delta={percent(ratioDelta(thisMonthStudents, previousMonthStudents))} />
            <MetricCard icon={BookOpen} label="Total Courses" value={courses.length} delta={percent(ratioDelta(thisMonthCourseCount, previousMonthCourseCount))} />
            <MetricCard icon={WalletCards} label="Total Earnings" value={formatMoney(totalEarnings || available, settings.currency)} delta={percent(ratioDelta(thisMonthEarnings, previousMonthEarnings))} />
            <MetricCard icon={Star} label="Avg. Rating" value={allReviews.length ? avgRating.toFixed(1) : 'N/A'} delta={percent(ratioDelta(thisMonthRating, previousMonthRating))} />
            <MetricCard icon={Clock3} label="Watch Time" value={`${compact(watchHours)}h`} delta={percent(0)} />
          </div>

          <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid content-start gap-5">
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.98fr]">
                <EarningsChart total={totalEarnings || available} currency={settings.currency} values={monthSeries.values} labels={monthSeries.labels} delta={ratioDelta(thisMonthEarnings, previousMonthEarnings)} />
                <StudentDonut total={totalStudents} newStudents={thisMonthStudents} completedStudents={completedStudents} />
              </div>

              <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-black text-white">My Courses</h2>
                  <Link href="/instructor/courses" className="text-sm font-bold text-violet-300 hover:text-white">View all</Link>
                </div>
                <div>
                  {courses.length ? (
                    courses.slice(0, 4).map((course) => <CourseRow key={course.id} course={course} currency={settings.currency} />)
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                      <p className="text-lg font-black text-white">Start your first course</p>
                      <p className="mt-2 text-sm text-slate-400">Create a polished course and it will appear in this teaching dashboard.</p>
                      <Link href="/instructor/courses/new" className="mt-5 inline-flex h-11 items-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white">Create Course</Link>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="grid content-start gap-5">
              <CalendarPanel events={calendarEvents} />

              <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-white">To Do List</h2>
                  <Link href="/instructor/assignments" className="text-sm font-bold text-violet-300 hover:text-white">View all</Link>
                </div>
                <div className="mt-4 grid gap-4">
                  {tasks.map((task) => (
                    <div key={task.title} className="flex gap-3 border-t border-slate-700/45 pt-4 first:border-t-0 first:pt-0">
                      <span className="mt-1 h-4 w-4 rounded border border-slate-600 bg-white/[0.03]" aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-bold text-white">{task.title}</span>
                        <span className="mt-1 block text-xs font-semibold text-amber-300">{task.due}</span>
                      </span>
                    </div>
                  ))}
                  {!tasks.length && <p className="text-sm font-semibold text-slate-400">No urgent tasks right now.</p>}
                </div>
              </section>

              <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-white">Recent Notifications</h2>
                  <Link href="/instructor/notifications" className="text-sm font-bold text-violet-300 hover:text-white">View all</Link>
                </div>
                <div className="mt-4 grid gap-4">
                  {notifications.length ? (
                    notifications.map((notification, index) => (
                      <div key={notification.id} className="flex gap-3 border-t border-slate-700/45 pt-4 first:border-t-0 first:pt-0">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${index === 0 ? 'bg-cyan-500/15 text-cyan-300' : index === 1 ? 'bg-amber-500/15 text-amber-300' : 'bg-violet-500/15 text-violet-300'}`}>
                          {index === 0 ? <UsersRound size={15} /> : index === 1 ? <Star size={15} /> : <FileQuestion size={15} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white">{notification.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{notification.body}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-semibold text-slate-400">No notifications yet.</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
