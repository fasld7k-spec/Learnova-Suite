/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import {
  Award,
  Bell,
  BookOpen,
  Bookmark,
  Brain,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutList,
  MessageCircle,
  Play,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trophy,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listHas } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

type StudentEnrollment = Prisma.EnrollmentGetPayload<{
  include: {
    certificate: true;
    course: {
      include: {
        category: true;
        modules: { include: { lessons: true } };
      };
    };
  };
}>;

function compact(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ST';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function calendarDays(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const days: { label: string; muted?: boolean; active?: boolean }[] = [];
  const previousMonthDays = new Date(year, month, 0).getDate();
  for (let index = leading - 1; index >= 0; index -= 1) days.push({ label: String(previousMonthDays - index), muted: true });
  for (let day = 1; day <= daysInMonth; day += 1) days.push({ label: String(day), active: day === date.getDate() });
  let trailing = 1;
  while (days.length % 7 !== 0) {
    days.push({ label: String(trailing), muted: true });
    trailing += 1;
  }
  return days.slice(0, 42);
}

function orderedLessons(enrollment?: StudentEnrollment) {
  return enrollment?.course.modules.flatMap((module) => module.lessons) || [];
}

function nextLessonTitle(enrollment: StudentEnrollment | undefined, completedLessonIds: Set<string>) {
  const lesson = orderedLessons(enrollment).find((item) => !completedLessonIds.has(item.id)) || orderedLessons(enrollment)[0];
  return lesson?.title || 'Continue your course plan';
}

function SidebarLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: LucideIcon; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 min-w-40 items-center gap-3 rounded-xl px-4 text-sm font-bold transition xl:min-w-0 ${
        active ? 'student-nav-active text-white' : 'student-nav-muted text-slate-400 hover:text-white'
      }`}
    >
      <Icon size={18} strokeWidth={1.8} />
      {label}
    </Link>
  );
}

function MetricCard({ label, value, sub, icon: Icon, tone }: { label: string; value: string | number; sub: string; icon: LucideIcon; tone: 'violet' | 'blue' | 'green' | 'amber' | 'indigo' }) {
  return (
    <article className={`student-metric student-metric-${tone} rounded-xl border border-slate-700/50 p-5`}>
      <div className="flex items-center gap-4">
        <span className={`student-metric-icon student-metric-icon-${tone} grid h-14 w-14 shrink-0 place-items-center rounded-full`}>
          <Icon size={25} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-300">{label}</p>
          <p className="mt-2 text-3xl font-black leading-none text-white">{value}</p>
          <p className="mt-2 text-sm font-semibold text-slate-400">{sub}</p>
        </div>
      </div>
    </article>
  );
}

function WeeklyChart({ values }: { values: number[] }) {
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 560;
    const y = 170 - (value / 100) * 135;
    return { x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-white">Weekly Activity</h2>
        <span className="rounded-lg border border-slate-700 bg-[#0a1020] px-3 py-2 text-xs font-bold text-white">This Week</span>
      </div>
      <svg viewBox="0 0 560 205" className="mt-4 h-64 w-full" role="img" aria-label="Weekly learning activity">
        <defs>
          <linearGradient id="studentChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => <line key={line} x1="0" x2="560" y1={35 + line * 40} y2={35 + line * 40} stroke="#253148" strokeWidth="1" />)}
        <path d={`${path} L 560 170 L 0 170 Z`} fill="url(#studentChartFill)" />
        <path d={path} fill="none" stroke="#8b5cf6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill={index === 8 ? '#fff' : '#a78bfa'} />)}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => <text key={label} x={index * 88 + 2} y="198" fill="#cbd5e1" fontSize="13">{label}</text>)}
      </svg>
    </section>
  );
}

function CourseThumb({ course, large = false }: { course: StudentEnrollment['course']; large?: boolean }) {
  return (
    <div className={`student-course-thumb grid shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-700/60 ${large ? 'h-36 w-full md:w-36' : 'aspect-[1.55] w-full'}`}>
      {course.coverImage ? <img src={course.coverImage} alt="" className="h-full w-full object-cover" /> : <BookOpen className="text-violet-200" size={large ? 48 : 44} />}
    </div>
  );
}

function CompactCourseThumb({ course }: { course: StudentEnrollment['course'] }) {
  return (
    <div className="student-course-thumb grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-700/60">
      {course.coverImage ? <img src={course.coverImage} alt="" className="h-full w-full object-cover" /> : <BookOpen className="text-violet-200" size={34} />}
    </div>
  );
}

function CourseCard({ enrollment }: { enrollment: StudentEnrollment }) {
  const started = enrollment.progress > 0;
  return (
    <article className="overflow-hidden rounded-xl border border-slate-700/50 bg-[#0c1425]/88">
      <div className="relative">
        <CourseThumb course={enrollment.course} />
        <span className={`absolute left-3 top-3 rounded-md px-2 py-1 text-xs font-bold text-white ${started ? 'bg-emerald-500/80' : 'bg-slate-500/80'}`}>
          {started ? 'In Progress' : 'Not Started'}
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-12 text-lg font-black leading-6 text-white">{enrollment.course.title}</h3>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, Math.max(0, enrollment.progress))}%` }} />
          </div>
          <span className="text-sm font-black text-white">{enrollment.progress}%</span>
        </div>
        <Link href={`/learn/${enrollment.course.slug}`} className="mt-4 flex h-10 items-center justify-between rounded-lg bg-white/[0.05] px-3 text-sm font-bold text-slate-200 hover:bg-violet-500/20">
          {started ? 'Continue Learning' : 'Start Course'}
          <ChevronRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function StudentHero({
  firstName,
  currentEnrollment,
  nextLesson,
}: {
  firstName: string;
  currentEnrollment?: StudentEnrollment;
  nextLesson: string;
}) {
  const actions: { href: string; label: string; icon: LucideIcon; assistantPrompt?: string }[] = [
    { href: currentEnrollment ? `/learn/${currentEnrollment.course.slug}` : '/student/my-courses', label: 'Continue Learning', icon: Play },
    { href: '/student/live-sessions', label: 'Join Live Session', icon: UsersRound },
    { href: '/community', label: 'Study Groups', icon: MessageCircle },
    {
      href: '/help',
      label: 'Ask AI Tutor',
      icon: Brain,
      assistantPrompt: currentEnrollment
        ? `Help me continue "${currentEnrollment.course.title}" and explain what I should study next.`
        : 'Help me choose a course and create a study plan.',
    },
  ];

  return (
    <section className="student-aurora-hero overflow-hidden rounded-3xl border border-violet-300/25 p-6 md:p-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-black tracking-normal text-white sm:text-4xl">{greeting()}, {firstName} 👋</h1>
        <p className="mt-2 text-base font-semibold text-slate-300">Keep learning and improving every day.</p>
        <form action="/courses" className="mt-6 flex h-14 max-w-xl items-center gap-3 rounded-2xl border border-violet-200/25 bg-[#080f24]/75 px-4 text-sm font-semibold text-slate-300 backdrop-blur">
          <Search size={18} />
          <input name="q" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" placeholder="Search for courses, lessons, topics..." />
          <button className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.07] text-slate-200" type="submit" aria-label="Search filters">
            <SlidersHorizontal size={16} />
          </button>
        </form>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="student-action-chip flex min-h-14 items-center gap-3 rounded-2xl px-3 text-sm font-black text-white transition hover:border-violet-300/45 hover:bg-violet-500/15"
              data-smart-assistant-trigger={action.assistantPrompt ? true : undefined}
              data-smart-assistant-prompt={action.assistantPrompt}
            >
              <span className="dashboard-icon-orb grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                <action.icon size={18} strokeWidth={1.9} />
              </span>
              <span className="leading-5">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
      {currentEnrollment ? (
        <p className="mt-6 inline-flex rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-slate-200 backdrop-blur">
          Next lesson: {nextLesson}
        </p>
      ) : null}
    </section>
  );
}

function ContinueLearningCard({ enrollment, nextLesson }: { enrollment?: StudentEnrollment; nextLesson: string }) {
  const progress = Math.min(100, Math.max(0, enrollment?.progress || 0));
  return (
    <section className="dashboard-glass-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-white">Continue Learning</h2>
        <span className="grid h-16 w-16 place-items-center rounded-full p-1 text-sm font-black text-white" style={{ background: `conic-gradient(#38bdf8 0 ${progress}%, rgba(255,255,255,0.08) ${progress}% 100%)` }}>
          <span className="grid h-full w-full place-items-center rounded-full bg-[#0b1323]">{progress}%</span>
        </span>
      </div>
      {enrollment ? (
        <div className="mt-4 grid gap-4">
          <div className="flex items-center gap-4">
            <CompactCourseThumb course={enrollment.course} />
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-base font-black leading-5 text-white">{enrollment.course.title}</h3>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${Math.min(100, Math.max(0, enrollment.progress))}%` }} />
              </div>
            </div>
          </div>
          <div className="grid gap-1">
            <p className="text-xs font-bold text-slate-400">Next Lesson</p>
            <p className="line-clamp-1 text-sm font-black text-white">{nextLesson}</p>
          </div>
          <Link href={`/learn/${enrollment.course.slug}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-black text-white shadow-[0_18px_44px_rgba(124,60,255,0.35)] hover:bg-violet-500">
            <Play size={17} />
            Continue
          </Link>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-5 text-center">
          <p className="text-sm font-bold text-slate-300">Enroll in a course to start learning.</p>
          <Link href="/courses" className="mt-4 inline-flex h-10 items-center rounded-full bg-violet-600 px-5 text-sm font-black text-white">Browse Courses</Link>
        </div>
      )}
    </section>
  );
}

function CalendarPanel({ upcomingTitle }: { upcomingTitle: string }) {
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
      <p className="mt-5 border-t border-slate-700/45 pt-4 text-sm font-bold text-slate-300">{upcomingTitle || 'No scheduled learning events today.'}</p>
    </section>
  );
}

function UpcomingItem({ icon: Icon, title, meta, tone, href }: { icon: LucideIcon; title: string; meta: string; tone: string; href?: string }) {
  const content = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">{meta}</p>
      </div>
    </>
  );
  const className = "flex gap-3 border-t border-slate-700/45 pt-4 transition first:border-t-0 first:pt-0 hover:text-violet-200";
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>
      {content}
    </div>
  );
}

export default async function Student() {
  const user = await requireUser(['STUDENT']);
  const settings = await getSiteSettings();
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      certificate: true,
      course: {
        include: {
          category: true,
        modules: { include: { lessons: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
      },
    },
    },
    orderBy: { createdAt: 'desc' },
  });
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const lessonIds = enrollments.flatMap((enrollment) => enrollment.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
  const now = new Date();
  const [completedLessonRows, quizAttempts, badges, assignments, liveSessions, calendarEvents, notifications, unreadNotifications, unreadMessages] = await Promise.all([
    lessonIds.length ? prisma.lessonProgress.findMany({ where: { userId: user.id, lessonId: { in: lessonIds }, completed: true }, select: { lessonId: true, updatedAt: true } }) : Promise.resolve([]),
    prisma.quizAttempt.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.badgeAward.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 3 }),
    courseIds.length ? prisma.assignment.findMany({ where: { courseId: { in: courseIds }, OR: [{ dueAt: { gte: now } }, { dueAt: null }] }, orderBy: { dueAt: 'asc' }, take: 3 }) : Promise.resolve([]),
    courseIds.length ? prisma.liveSession.findMany({ where: { courseId: { in: courseIds }, startsAt: { gte: now } }, orderBy: { startsAt: 'asc' }, take: 3 }) : Promise.resolve([]),
    prisma.calendarEvent.findMany({ where: { startsAt: { gte: now }, OR: [{ userId: user.id }, { userId: null }] }, orderBy: { startsAt: 'asc' }, take: 3 }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    prisma.message.count({ where: { senderId: { not: user.id }, read: false, conversation: { userIds: listHas(user.id) } } }),
  ]);

  const completedLessonIds = new Set(completedLessonRows.map((row) => row.lessonId));
  const completedLessons = completedLessonRows.length;
  const totalLessons = enrollments.reduce((sum, enrollment) => sum + enrollment.course.modules.reduce((moduleSum, module) => moduleSum + module.lessons.length, 0), 0);
  const overallProgress = enrollments.length ? Math.round(enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / enrollments.length) : 0;
  const currentEnrollment = enrollments.find((enrollment) => enrollment.progress > 0 && enrollment.progress < 100) || enrollments[0];
  const inProgress = enrollments.filter((enrollment) => enrollment.progress > 0 && enrollment.progress < 100).length;
  const certificates = enrollments.filter((enrollment) => enrollment.certificate).length;
  const xpPoints = completedLessons * 75 + certificates * 250 + quizAttempts.filter((attempt) => attempt.passed).length * 120;
  const completedDayKeys = new Set(completedLessonRows.map((row) => {
    const date = new Date(row.updatedAt);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().slice(0, 10);
  }));
  let streakDays = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    if (!completedDayKeys.has(day.toISOString().slice(0, 10))) break;
    streakDays += 1;
  }
  const level = Math.max(1, Math.floor(xpPoints / 350) + 1);
  const displayName = settings.siteName;
  const firstName = user.name.split(' ')[0] || 'Student';
  const weeklyCounts = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    return completedLessonRows.filter((row) => {
      const updated = new Date(row.updatedAt);
      updated.setHours(0, 0, 0, 0);
      return updated.getTime() === day.getTime();
    }).length;
  });
  const weeklyCompleted = weeklyCounts.reduce((sum, count) => sum + count, 0);
  const maxWeeklyCount = Math.max(...weeklyCounts, 1);
  const weeklyChartValues = weeklyCounts.map((count) => Math.round((count / maxWeeklyCount) * 86));
  const upcoming = [
    ...assignments.map((assignment) => ({ title: assignment.title, meta: assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Due soon', icon: ClipboardList, tone: 'bg-violet-500/25 text-violet-200', href: '/student/assignments' })),
    ...liveSessions.map((session) => ({ title: session.title, meta: session.startsAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), icon: CalendarDays, tone: 'bg-emerald-500/20 text-emerald-200', href: '/student/live-sessions' })),
    ...calendarEvents.map((event) => ({ title: event.title, meta: event.startsAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), icon: CalendarDays, tone: 'bg-amber-500/20 text-amber-200', href: '/calendar' })),
  ].slice(0, 3);

  return (
    <main className="moe-student-redesign min-h-screen bg-[#050a16] text-white">
      <div className="grid min-h-screen w-full max-w-full overflow-x-hidden xl:grid-cols-[286px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden border-b border-slate-800/80 bg-[#071021] p-5 xl:sticky xl:top-0 xl:h-screen xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="student-brand-mark grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white">
                <GraduationCap size={22} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xl font-black">{displayName}</span>
                <span className="text-sm font-semibold text-violet-300">Learning Platform</span>
              </span>
            </Link>
              <Link href="/student/notifications" aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-700/70 text-slate-300 sm:hidden">
              <Bell size={18} />
              {unreadNotifications ? <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[11px] font-black">{unreadNotifications}</span> : null}
            </Link>
          </div>

          <nav className="scrollbar-none mt-6 flex w-full gap-2 overflow-x-auto pb-2 xl:mt-8 xl:grid xl:overflow-visible xl:pb-0" aria-label="Student dashboard navigation">
            <SidebarLink active href="/student" icon={Home} label="Dashboard" />
            <SidebarLink href="/student/my-courses" icon={BookOpen} label="My Courses" />
            <SidebarLink href={currentEnrollment ? `/learn/${currentEnrollment.course.slug}` : '/student/my-courses'} icon={LayoutList} label="Lessons" />
            <SidebarLink href="/student/assignments" icon={ClipboardList} label="Assignments" />
            <SidebarLink href="/student/quizzes" icon={CheckSquare} label="Quizzes" />
            <SidebarLink href="/student/certificates" icon={ShieldCheck} label="Certificates" />
            <SidebarLink href="/student/resources" icon={FileText} label="Notes" />
            <SidebarLink href="/student/bookmarks" icon={Bookmark} label="Bookmarks" />
            <SidebarLink href="/community" icon={MessageCircle} label="Discussions" />
            <SidebarLink href="/student/badges" icon={Trophy} label="Achievements" />
            <SidebarLink href="/student/preferences" icon={SlidersHorizontal} label="Settings" />
          </nav>

          <section className="mt-6 hidden rounded-xl border border-violet-400/20 bg-violet-600/15 p-4 md:block xl:mt-8">
            <h2 className="text-sm font-black">Upgrade to Pro</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Unlock all features and get unlimited access.</p>
            <Link href="/pricing" className="mt-4 inline-flex h-10 items-center rounded-lg bg-violet-600 px-4 text-sm font-black text-white">Upgrade Now</Link>
          </section>

          <div className="mt-6 hidden rounded-xl border border-slate-700/70 bg-[#0b1323] p-4 sm:block xl:mt-8">
            <div className="flex items-center gap-3">
              {user.avatar ? <img src={user.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-sm font-black">{initials(user.name)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{user.name}</p>
                <p className="text-xs font-semibold text-slate-400">Student</p>
              </div>
              <Link href="/profile" className="text-slate-400 hover:text-white" aria-label="Profile">
                <UserRound size={17} />
              </Link>
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-5 lg:p-8">
          <header className="flex flex-wrap items-center justify-end gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              <Link href="/student/notifications" aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-700/70 bg-[#0b1323] text-slate-300">
                <Bell size={18} />
                {unreadNotifications ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black">{unreadNotifications}</span> : null}
              </Link>
              <Link href="/messages" aria-label="Messages" className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-700/70 bg-[#0b1323] text-slate-300">
                <MessageCircle size={18} />
                {unreadMessages ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black">{unreadMessages}</span> : null}
              </Link>
              <Link href="/profile" className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-slate-700/70 bg-[#0b1323] text-sm font-black text-white" aria-label="Profile">
                {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initials(user.name)}
              </Link>
            </div>
          </header>

          <div className="mt-3 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <StudentHero firstName={firstName} currentEnrollment={currentEnrollment} nextLesson={nextLessonTitle(currentEnrollment, completedLessonIds)} />
            <ContinueLearningCard enrollment={currentEnrollment} nextLesson={nextLessonTitle(currentEnrollment, completedLessonIds)} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={BookOpen} label="Courses Enrolled" value={enrollments.length} sub={`${inProgress} In Progress`} tone="violet" />
            <MetricCard icon={GraduationCap} label="Lessons Completed" value={completedLessons} sub={`of ${totalLessons} lessons`} tone="blue" />
            <MetricCard icon={Award} label="My Progress" value={`${overallProgress}%`} sub={`${weeklyCompleted} completed this week`} tone="green" />
            <MetricCard icon={Star} label="Current Streak" value={`${streakDays} Days`} sub="Keep it up!" tone="amber" />
            <MetricCard icon={Trophy} label="XP Points" value={compact(xpPoints)} sub={`Level ${level}`} tone="indigo" />
          </div>

          <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid content-start gap-5">
              <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black text-white">My Courses</h2>
                  <Link href="/student/my-courses" className="text-sm font-bold text-violet-300 hover:text-white">View all</Link>
                </div>
                {enrollments.length ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {enrollments.slice(0, 4).map((enrollment) => <CourseCard key={enrollment.id} enrollment={enrollment} />)}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                    <p className="text-lg font-black text-white">No courses yet</p>
                    <p className="mt-2 text-sm text-slate-400">Browse the marketplace and enroll to start learning.</p>
                    <Link href="/courses" className="mt-5 inline-flex h-11 items-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white">Browse Courses</Link>
                  </div>
                )}
              </section>

              <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <WeeklyChart values={weeklyChartValues} />
                <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                  <h2 className="text-base font-black text-white">Keep Going!</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-400">You have completed {weeklyCompleted} lessons this week.</p>
                  <div className="mt-6 flex items-center gap-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${overallProgress}%` }} />
                    </div>
                    <span className="text-sm font-black text-slate-300">{overallProgress}%</span>
                  </div>
                </section>
              </div>
              <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">Need Help?</h2>
                  <HelpCircle size={42} className="text-violet-300" />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-400">Visit the help center or ask in the community.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/help" className="rounded-lg bg-white/[0.06] px-4 py-2 text-sm font-bold text-white">Help Center</Link>
                  <Link href="/community" className="rounded-lg bg-white/[0.06] px-4 py-2 text-sm font-bold text-white">Community</Link>
                </div>
              </section>
            </div>

            <aside className="grid content-start gap-5">
              <CalendarPanel upcomingTitle={upcoming[0]?.title || ''} />
              <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">Upcoming</h2>
                  <Link href="/calendar" className="text-sm font-bold text-violet-300 hover:text-white">View all</Link>
                </div>
                <div className="mt-5 grid gap-4">
                  {upcoming.length ? upcoming.map((item) => <UpcomingItem key={`${item.title}-${item.meta}`} icon={item.icon} title={item.title} meta={item.meta} tone={item.tone} href={item.href} />) : (
                    <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center">
                      <p className="text-sm font-black text-white">No upcoming deadlines</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Your assignments, live classes, and calendar events will appear here.</p>
                      <Link href="/calendar" className="mt-4 inline-flex h-9 items-center rounded-lg bg-white/[0.06] px-4 text-xs font-black text-white hover:bg-violet-500/20">Open calendar</Link>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white">Achievements</h2>
                  <Link href="/student/badges" className="text-sm font-bold text-violet-300 hover:text-white">View all</Link>
                </div>
                {badges.length ? (
                  <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                    {badges.map((badge) => (
                      <div key={badge.id}>
                        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-violet-300/30 bg-white/[0.04] text-violet-300">
                          <ShieldCheck size={28} />
                        </span>
                        <p className="mt-3 text-sm font-black text-white">{badge.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{badge.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-5 text-center">
                    <p className="text-sm font-black text-white">No achievements yet</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">Complete lessons, pass quizzes, and finish courses to unlock real badges.</p>
                  </div>
                )}
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
