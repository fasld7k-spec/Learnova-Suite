/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckSquare,
  Clock3,
  ClipboardList,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Send,
  ShieldCheck,
  Star,
  StickyNote,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IN';
}

function SidebarLink({ href, label, icon: Icon, active = false }: { href: string; label: string; icon: LucideIcon; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-12 min-w-40 items-center gap-3 rounded-xl px-4 text-sm font-bold transition xl:min-w-0 ${
        active ? 'teacher-nav-active text-white' : 'teacher-nav-muted text-slate-400 hover:text-white'
      }`}
    >
      <Icon size={18} strokeWidth={1.8} />
      {label}
    </Link>
  );
}

function RatingStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-amber-300" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={14} className={index < value ? 'fill-current' : ''} />
      ))}
    </span>
  );
}

export default async function InstructorReviews(props: { searchParams?: Promise<{ saved?: string; sent?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['INSTRUCTOR']);
  const [settings, reviews, notifications] = await Promise.all([
    getSiteSettings(),
    prisma.review.findMany({
      where: { course: { instructorId: user.id } },
      include: { user: true, course: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 3 }),
  ]);
  const displayName = settings.siteName;
  const reviewIds = reviews.map((review) => review.id);
  const notes = reviewIds.length
    ? await prisma.adminNote.findMany({
        where: { entity: 'review', entityId: { in: reviewIds } },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const notesByReview = new Map<string, typeof notes>();
  for (const note of notes) {
    notesByReview.set(note.entityId, [...(notesByReview.get(note.entityId) || []), note]);
  }
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const fiveStars = reviews.filter((review) => review.rating === 5).length;

  return (
    <main className="moe-instructor-redesign min-h-screen bg-[#050a16] text-white">
      <div className="grid min-h-screen w-full max-w-full overflow-x-hidden xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden border-b border-slate-800/80 bg-[#071021] p-5 xl:sticky xl:top-0 xl:h-screen xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="teacher-brand-mark grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white">
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

          <nav className="mt-6 flex w-full gap-2 overflow-x-auto pb-2 xl:mt-8 xl:grid xl:overflow-visible xl:pb-0" aria-label="Instructor reviews navigation">
            <SidebarLink href="/instructor" icon={LayoutDashboard} label="Dashboard" />
            <SidebarLink href="/instructor/courses" icon={BookOpen} label="My Courses" />
            <SidebarLink href="/instructor/students" icon={UsersRound} label="Students" />
            <SidebarLink href="/instructor/live-sessions" icon={Clock3} label="Lessons" />
            <SidebarLink href="/instructor/assignments" icon={ClipboardList} label="Assignments" />
            <SidebarLink href="/instructor/quizzes" icon={CheckSquare} label="Quizzes" />
            <SidebarLink href="/instructor/questions" icon={MessageCircle} label="Discussions" />
            <SidebarLink href="/instructor/earnings" icon={WalletCards} label="Earnings" />
            <SidebarLink href="/instructor/analytics" icon={BarChart3} label="Analytics" />
            <SidebarLink active href="/instructor/reviews" icon={ShieldCheck} label="Reviews" />
          </nav>

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
          {searchParams?.error ? (
            <div className="mb-6 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">{searchParams.error}</div>
          ) : searchParams?.sent ? (
            <div className="mb-6 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">Review reply sent successfully.</div>
          ) : searchParams?.saved ? (
            <div className="mb-6 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">Review note saved successfully.</div>
          ) : null}
          <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-normal text-white sm:text-4xl">Student reviews</h1>
              <p className="mt-2 text-base font-semibold text-slate-400">Track feedback, ratings, and courses that need follow-up.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/api/instructor/reviews/export" className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-slate-700 bg-[#0b1323] px-4 text-sm font-bold text-white hover:border-violet-400/50">
                <Download size={16} />
                Export CSV
              </Link>
              <Link href="/instructor" className="inline-flex h-11 w-fit items-center rounded-xl border border-slate-700 bg-[#0b1323] px-4 text-sm font-bold text-white hover:border-violet-400/50">
                Back to dashboard
              </Link>
            </div>
          </header>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <article className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
              <p className="text-xs font-semibold text-slate-400">Average Rating</p>
              <p className="mt-3 text-3xl font-black text-white">{average ? average.toFixed(1) : '0.0'}</p>
              <p className="mt-3 text-sm font-bold text-amber-300">{reviews.length} total reviews</p>
            </article>
            <article className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
              <p className="text-xs font-semibold text-slate-400">Five-star Reviews</p>
              <p className="mt-3 text-3xl font-black text-white">{fiveStars}</p>
              <p className="mt-3 text-sm font-bold text-emerald-300">{reviews.length ? Math.round((fiveStars / reviews.length) * 100) : 0}% of feedback</p>
            </article>
            <article className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
              <p className="text-xs font-semibold text-slate-400">Courses Reviewed</p>
              <p className="mt-3 text-3xl font-black text-white">{new Set(reviews.map((review) => review.courseId)).size}</p>
              <p className="mt-3 text-sm font-bold text-violet-300">Instructor catalog</p>
            </article>
            <article className="rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
              <p className="text-xs font-semibold text-slate-400">Follow-ups Logged</p>
              <p className="mt-3 text-3xl font-black text-white">{notes.length}</p>
              <p className="mt-3 text-sm font-bold text-sky-300">Internal notes and replies</p>
            </article>
          </div>

          <section className="mt-5 rounded-xl border border-slate-700/50 bg-[#0c1425]/88 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-white">Latest feedback</h2>
              <span className="text-sm font-bold text-slate-400">{reviews.length} rows</span>
            </div>
            <div className="grid">
              {reviews.length ? reviews.map((review) => {
                const latestNote = notesByReview.get(review.id)?.[0];
                return (
                  <article key={review.id} className="border-t border-slate-700/45 py-5 first:border-t-0">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_160px_minmax(0,1fr)_120px] lg:items-center">
                      <div className="min-w-0">
                        <Link href={`/instructor/courses/${review.courseId}`} className="line-clamp-2 text-base font-black text-white hover:text-violet-200">
                          {review.course.title}
                        </Link>
                        <p className="mt-2 text-sm font-semibold text-slate-400">{review.user.name}</p>
                      </div>
                      <div>
                        <RatingStars value={review.rating} />
                        <p className="mt-1 text-xs font-bold text-slate-500">{review.rating}/5 rating</p>
                      </div>
                      <p className="line-clamp-3 text-sm font-semibold leading-6 text-slate-300">{review.comment || 'No written comment.'}</p>
                      <p className="text-sm font-bold text-slate-500 lg:text-right">{review.createdAt.toLocaleDateString()}</p>
                    </div>

                    {latestNote ? (
                      <div className="mt-4 rounded-xl border border-slate-700/50 bg-[#071021] p-4">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-300">
                          <StickyNote size={14} />
                          Latest follow-up
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{latestNote.note}</p>
                        <p className="mt-2 text-xs font-bold text-slate-500">{latestNote.createdAt.toLocaleString()}</p>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <form action="/api/instructor/reviews" method="post" className="rounded-xl border border-slate-700/50 bg-[#071021] p-4">
                        <CsrfInput />
                        <input type="hidden" name="_action" value="note" />
                        <input type="hidden" name="reviewId" value={review.id} />
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400" htmlFor={`note-${review.id}`}>Internal follow-up</label>
                        <textarea id={`note-${review.id}`} name="note" rows={3} className="mt-3 w-full rounded-xl border border-slate-700 bg-[#050a16] p-3 text-sm font-semibold text-white outline-none focus:border-sky-400" placeholder="Add a private action note for this review." />
                        <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-sky-500 px-4 text-sm font-black text-white hover:bg-sky-400" type="submit">
                          <StickyNote size={15} />
                          Save follow-up
                        </button>
                      </form>

                      <form action="/api/instructor/reviews" method="post" className="rounded-xl border border-slate-700/50 bg-[#071021] p-4">
                        <CsrfInput />
                        <input type="hidden" name="_action" value="notify" />
                        <input type="hidden" name="reviewId" value={review.id} />
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400" htmlFor={`reply-${review.id}`}>Notify student</label>
                        <textarea id={`reply-${review.id}`} name="body" rows={3} className="mt-3 w-full rounded-xl border border-slate-700 bg-[#050a16] p-3 text-sm font-semibold text-white outline-none focus:border-sky-400" defaultValue={`Thank you for reviewing ${review.course.title}. Your feedback helps us improve the course experience.`} />
                        <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-slate-600 px-4 text-sm font-black text-white hover:border-sky-400" type="submit">
                          <Send size={15} />
                          Send notification
                        </button>
                      </form>
                    </div>
                  </article>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-lg font-black text-white">No reviews yet</p>
                  <p className="mt-2 text-sm text-slate-400">New course feedback will appear here when students submit reviews.</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
