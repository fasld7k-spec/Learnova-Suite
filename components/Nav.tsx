import Link from 'next/link';
import { Bell, GraduationCap, LogIn, Menu, Search, ShoppingCart, UserRound } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NavPrimaryLinks } from '@/components/NavPrimaryLinks';
import { getSession } from '@/lib/auth';
import { localizedCopy } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings, type SiteLink } from '@/lib/site-settings';

export async function Nav() {
  const [settings, session] = await Promise.all([getSiteSettings(), getSession()]);
  const displayName = settings.siteName;
  const unreadCount = session ? await prisma.notification.count({ where: { userId: session.id, read: false } }) : 0;
  const notificationHref = session?.role === 'STUDENT'
    ? '/student/notifications'
    : session?.role === 'ADMIN'
      ? '/admin/notifications'
      : session?.role === 'INSTRUCTOR'
        ? '/instructor/notifications'
        : '/notifications';
  const copy = localizedCopy(settings.defaultLanguage);
  const visibleLinks = settings.navLinks.filter((link) => settings.instructorsEnabled || !['/instructors', '/mentorship'].includes(link.href));
  const coreLinks: SiteLink[] = [
    { href: '/', label: 'Home' },
    { href: '/courses', label: 'Courses' },
    { href: session?.role === 'STUDENT' ? '/student/my-courses' : '/learning-paths', label: session?.role === 'STUDENT' ? 'My Learning' : 'Paths' },
    { href: '/community', label: 'Community' },
    { href: '/blog', label: 'Blog' },
    { href: '/pricing', label: 'Pricing' },
  ].filter((link, index, list) => list.findIndex((item) => item.href === link.href) === index);
  const moreLinks = visibleLinks.filter((link) => !coreLinks.some((core) => core.href === link.href)).slice(0, 15);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/78 backdrop-blur-2xl">
      <div className="page-shell flex min-h-16 min-w-0 items-center justify-between gap-3 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={`${displayName} home`}>
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_0_28px_rgba(124,60,255,0.35)]">
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="" className="h-6 w-6 object-contain" />
            ) : (
              <GraduationCap size={20} strokeWidth={2} />
            )}
          </span>
          <span className="block text-base font-black leading-tight text-white">{displayName}</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label={copy.common.primaryNavigation}>
          <NavPrimaryLinks links={coreLinks} />
          {moreLinks.length > 0 && (
            <details className="group relative">
              <summary className="hidden min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-[13px] font-bold text-slate-300 transition hover:bg-white/5 hover:text-white xl:inline-flex">
                <Menu size={16} strokeWidth={1.8} />
                {copy.common.more}
              </summary>
              <div className="moe-panel absolute right-0 mt-4 hidden w-[560px] grid-cols-3 gap-1 rounded-xl p-3 group-open:grid">
                {moreLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-violet-500/15 hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          )}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Link href="/courses" className="moe-control hidden h-10 w-[min(24vw,300px)] items-center gap-3 px-4 text-sm text-slate-400 xl:flex">
            <Search size={17} />
            <span className="truncate">Search for courses, topics...</span>
          </Link>
          <details className="group relative lg:hidden">
            <summary className="moe-control grid h-10 w-10 cursor-pointer list-none place-items-center" aria-label={copy.common.openNavigation}>
              <Menu size={18} strokeWidth={1.8} />
            </summary>
            <div className="moe-panel absolute right-0 mt-3 hidden w-[min(calc(100vw-2rem),340px)] gap-1 rounded-xl p-3 group-open:grid">
              {[...coreLinks, ...moreLinks].map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-violet-500/15 hover:text-white">
                  {item.label}
                </Link>
              ))}
              <div className="my-1 border-t border-violet-300/15" />
              {!session ? (
                <>
                  <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-violet-500/15 hover:text-white">
                    {copy.common.login}
                  </Link>
                  {settings.registrationEnabled && (
                    <Link href="/register" className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500">
                      {copy.common.start}
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-violet-500/15 hover:text-white">
                    {copy.common.dashboard}
                  </Link>
                  <Link href="/profile" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-violet-500/15 hover:text-white">
                    {copy.common.profile}
                  </Link>
                </>
              )}
            </div>
          </details>
          <Link className="grid h-10 w-10 place-items-center rounded-lg text-slate-200 transition hover:bg-white/5 hover:text-white xl:hidden" href="/courses" aria-label={copy.common.searchCourses}>
            <Search size={17} />
          </Link>
          <span className="hidden lg:inline-flex"><LanguageSwitcher code={settings.defaultLanguage} name={settings.activeLanguageName} /></span>
          {!session && (
            <Link className="hidden h-10 items-center px-3 text-[13px] font-bold text-slate-300 transition hover:text-white lg:inline-flex" href="/login">
              {copy.common.login}
            </Link>
          )}
          <Link className="grid h-10 w-10 place-items-center rounded-lg text-slate-200 transition hover:bg-white/5 hover:text-white" href="/cart" aria-label={copy.common.cart}>
            <ShoppingCart size={17} />
          </Link>
          {session && (
            <Link className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-200 transition hover:bg-white/5 hover:text-white" href={notificationHref}>
              <Bell size={17} />
              {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-400 ring-2 ring-[#020617]" />}
            </Link>
          )}
          <Link
            className="hidden h-10 w-10 place-items-center rounded-full border border-violet-300/20 bg-white/10 text-white lg:grid"
            href={session ? '/profile' : '/login'}
            aria-label={session ? copy.common.profile : copy.common.login}
          >
            {session ? <UserRound size={17} /> : <LogIn size={17} />}
          </Link>
          {!session && settings.registrationEnabled && (
            <Link className="hidden h-10 items-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)] px-4 text-[13px] font-black text-[var(--button-text)] shadow-[0_16px_38px_rgba(124,60,255,0.28)] transition hover:brightness-110 lg:inline-flex" href="/register">
              Sign up
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
