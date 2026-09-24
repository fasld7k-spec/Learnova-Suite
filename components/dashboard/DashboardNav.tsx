'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  Brain,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock3,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  LockKeyhole,
  MessageCircle,
  Milestone,
  Settings2,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  WalletCards,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Item = { href: string; label: string };
type NavSection = { title: string; items: Item[] };

const studentIcons: Record<string, LucideIcon> = {
  '/student': Home,
  '/student/my-courses': BookOpen,
  '/student/assignments': ClipboardList,
  '/student/quizzes': CheckSquare,
  '/student/certificates': ShieldCheck,
  '/student/resources': FileText,
  '/student/bookmarks': Bookmark,
  '/community': MessageCircle,
  '/student/live-sessions': CalendarDays,
  '/student/badges': Trophy,
  '/student/notifications': Bell,
  '/student/preferences': Settings,
  '/student/privacy': LockKeyhole,
};

const instructorIcons: Record<string, LucideIcon> = {
  '/instructor': Home,
  '/instructor/analytics': BarChart3,
  '/instructor/courses': BookOpen,
  '/instructor/courses/new': GraduationCap,
  '/instructor/ai-course-ideas': Brain,
  '/instructor/availability': CalendarDays,
  '/instructor/bookings': Clock3,
  '/instructor/live-sessions': CalendarDays,
  '/instructor/cohorts': UsersRound,
  '/instructor/mentor-programs': UsersRound,
  '/instructor/coupons': DollarSign,
  '/instructor/resources': FileText,
  '/instructor/milestones': Milestone,
  '/instructor/payout-methods': WalletCards,
  '/instructor/students': UsersRound,
  '/instructor/quizzes': CheckSquare,
  '/instructor/drip': Settings2,
  '/instructor/assignments': ClipboardList,
  '/instructor/submissions': ClipboardList,
  '/instructor/questions': MessageCircle,
  '/instructor/reviews': ShieldCheck,
  '/instructor/faqs': MessageCircle,
  '/instructor/course-announcements': Bell,
  '/instructor/notifications': Bell,
  '/instructor/earnings': WalletCards,
};

export function DashboardNav({
  items,
  sections,
  rootHref,
  label
}: {
  items: Item[];
  sections?: NavSection[];
  rootHref: string;
  label: string;
}) {
  const pathname = usePathname();
  const instructorNav = rootHref === '/instructor';
  const studentNav = rootHref === '/student';
  const navSections = useMemo(() => (sections?.length ? sections : [{ title: '', items }]), [items, sections]);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return navSections;

    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
      }))
      .filter((section) => section.items.length > 0);
  }, [navSections, normalizedQuery]);
  const activeSectionTitle = useMemo(() => {
    return navSections.find((section) =>
      section.items.some((item) => (item.href === rootHref ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)))
    )?.title;
  }, [navSections, pathname, rootHref]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    activeSectionTitle ? { [activeSectionTitle]: true } : {}
  );

  useEffect(() => {
    if (!activeSectionTitle) return;
    setOpenSections((current) => ({ ...current, [activeSectionTitle]: true }));
  }, [activeSectionTitle]);

  useEffect(() => {
    if (!normalizedQuery) return;
    setOpenSections((current) => ({
      ...current,
      ...Object.fromEntries(visibleSections.filter((section) => section.title).map((section) => [section.title, true]))
    }));
  }, [normalizedQuery, visibleSections]);

  const renderLink = (item: Item) => {
    const active = item.href === rootHref ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = studentNav ? studentIcons[item.href] : instructorNav ? instructorIcons[item.href] : undefined;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-violet-500/15 lg:shrink ${
          active
            ? instructorNav ? 'teacher-nav-active text-white' : studentNav ? 'student-nav-active text-white' : 'bg-violet-600 text-white shadow-[0_12px_32px_rgba(124,60,255,0.28)]'
            : instructorNav ? 'teacher-nav-muted text-slate-400' : studentNav ? 'student-nav-muted text-slate-400 hover:text-white' : 'border border-violet-300/15 text-slate-300 lg:border-transparent'
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          {Icon ? <Icon className="shrink-0" size={18} strokeWidth={1.8} /> : null}
          <span className="truncate">{item.label}</span>
        </span>
        <span className={`hidden h-1.5 w-1.5 rounded-full lg:block ${active ? 'bg-cyan-300' : 'bg-transparent group-hover:bg-violet-300/60'}`} />
      </Link>
    );
  };

  return (
    <nav className="mt-5 min-w-0 lg:mt-6" aria-label={label}>
      <label className="relative mb-4 hidden lg:block">
        <span className="sr-only">Search dashboard navigation</span>
        <Search size={16} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          id={`${rootHref.slice(1) || 'dashboard'}-nav-search`}
          name="dashboardNavSearch"
          className="moe-control h-10 w-full pl-9 pr-3 text-sm font-semibold text-white placeholder:text-slate-500"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search navigation..."
        />
      </label>

      <div className="scrollbar-none flex w-full min-w-0 max-w-full gap-3 overflow-x-auto pb-1 pr-1 lg:grid lg:max-h-none lg:gap-3 lg:overflow-x-visible lg:overflow-y-auto lg:pb-0">
        {visibleSections.map((section) => (
          <section key={section.title || 'main'} className="min-w-max lg:min-w-0">
            {section.title ? (
              <>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-[11px] font-black uppercase transition hover:bg-violet-500/15 ${
                    openSections[section.title] ? 'border-violet-300/20 bg-white/5 text-white' : 'border-transparent text-slate-400'
                  }`}
                  aria-expanded={Boolean(openSections[section.title])}
                  onClick={() => setOpenSections((current) => ({ ...current, [section.title]: !current[section.title] }))}
                >
                  <span className="truncate">{section.title}</span>
                  <span className="ml-auto rounded-md border border-violet-300/15 px-1.5 py-0.5 text-[10px] text-slate-400">{section.items.length}</span>
                  <ChevronDown
                    size={15}
                    strokeWidth={1.8}
                    className={`shrink-0 transition-transform ${openSections[section.title] ? 'rotate-180 text-violet-300' : 'text-slate-400'}`}
                  />
                </button>
                {openSections[section.title] && (
                  <div className="mt-2 flex gap-2 lg:grid lg:gap-1">{section.items.map(renderLink)}</div>
                )}
              </>
            ) : (
              <div className="flex gap-2 lg:grid lg:gap-1">{section.items.map(renderLink)}</div>
            )}
          </section>
        ))}
        {visibleSections.length === 0 && (
          <div className="rounded-lg border border-violet-300/15 bg-white/[0.03] px-3 py-4 text-sm font-semibold text-slate-400">
            No navigation items found.
          </div>
        )}
      </div>
    </nav>
  );
}
