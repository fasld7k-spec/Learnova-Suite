import Link from 'next/link';
import { ReactNode } from 'react';
import { ArrowUpRight, Bell, BookOpen, CalendarDays, GraduationCap, LogOut, MessageCircle, PanelLeft, Plus, Search, Trophy, UserRound } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { AuthorCredit } from '@/components/dashboard/AuthorCredit';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { requireUser } from '@/lib/auth';
import { listHas } from '@/lib/json-fields';
import { localizedCopy, localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

type Item={href:string;label:string};
type NavSectionDefinition = { title: string; hrefs: string[] };
type DashboardRole = 'admin' | 'instructor' | 'student';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'ST';
}

const groups:Record<DashboardRole,Item[]>={
  admin:[
    {href:'/admin',label:'Overview'},{href:'/admin/marketplace-health',label:'Marketplace Health'},{href:'/admin/quick-actions',label:'Quick Actions'},{href:'/admin/users',label:'Users'},{href:'/admin/privacy-requests',label:'Privacy Requests'},{href:'/admin/data-retention',label:'Data Retention'},{href:'/admin/consents',label:'Consents'},{href:'/admin/cookie-categories',label:'Cookie Categories'},{href:'/admin/dpa',label:'DPA'},{href:'/admin/login-history',label:'Login History'},{href:'/admin/organizations',label:'Organizations'},{href:'/admin/organization-members',label:'Organization Members'},{href:'/admin/tenants',label:'Tenants'},{href:'/admin/tenant-members',label:'Tenant Members'},{href:'/admin/tenant-courses',label:'Tenant Courses'},{href:'/admin/domains',label:'Domains'},{href:'/admin/instructors',label:'Instructor Approvals'},
    {href:'/admin/courses',label:'Courses'},{href:'/admin/scorm',label:'SCORM-style Launcher'},{href:'/admin/lti-tools',label:'LTI Tool Registry'},{href:'/admin/course-import-export',label:'Course Import/Export'},{href:'/admin/learning-paths',label:'Learning Paths'},{href:'/admin/career-tracks',label:'Career Tracks'},{href:'/admin/jobs-board',label:'Jobs Board'},{href:'/admin/course-skills',label:'Course Skills'},{href:'/admin/course-licenses',label:'Course Licenses'},{href:'/admin/course-translations',label:'Course Translations'},{href:'/admin/prerequisites',label:'Prerequisites'},{href:'/admin/categories',label:'Categories'},{href:'/admin/live-sessions',label:'Live Sessions'},{href:'/admin/orders',label:'Orders'},{href:'/admin/procurement',label:'Procurement'},{href:'/admin/purchase-orders',label:'Purchase Orders'},{href:'/admin/vendors',label:'Vendors'},{href:'/admin/vendor-contracts',label:'Vendor Contracts'},
    {href:'/admin/withdrawals',label:'Withdrawals'},{href:'/admin/coupons',label:'Coupons'},{href:'/admin/grants',label:'Grants'},{href:'/admin/scholarships',label:'Scholarships'},{href:'/admin/donations',label:'Donations'},{href:'/admin/coupon-redemptions',label:'Coupon Redemptions'},{href:'/admin/bundles',label:'Bundles'},{href:'/admin/refunds',label:'Refunds'},{href:'/admin/invoice-templates',label:'Invoice Templates'},{href:'/admin/announcements',label:'Announcements'},{href:'/admin/notifications',label:'Notifications'},{href:'/admin/messages',label:'Message Center'},{href:'/admin/reviews',label:'Reviews'},{href:'/admin/instructor-reviews',label:'Instructor Reviews'},{href:'/admin/course-reports',label:'Course Reports'},{href:'/admin/abuse-reports',label:'Abuse Reports'},{href:'/admin/moderation-rules',label:'Moderation Rules'},{href:'/admin/moderation-queue',label:'Moderation Queue'},{href:'/admin/discussions',label:'Discussions'},
    {href:'/admin/certificates',label:'Certificates'},{href:'/admin/certificate-templates',label:'Certificate Templates'},{href:'/admin/badges',label:'Badges'},{href:'/admin/instructor-badges',label:'Instructor Badges'},{href:'/admin/pages',label:'Static Pages'},{href:'/admin/home-sections',label:'Home Sections'},{href:'/admin/seo',label:'SEO'},{href:'/admin/seo-redirects',label:'SEO Redirects'},{href:'/admin/seo-meta',label:'SEO Meta'},{href:'/admin/blog',label:'Blog'},
    {href:'/admin/sliders',label:'Home Slider'},{href:'/admin/languages',label:'Languages'},{href:'/admin/currencies',label:'Currencies'},
    {href:'/admin/payment-methods',label:'Payment Methods'},{href:'/admin/payment-gateways',label:'Payment Gateways'},{href:'/admin/payment-test',label:'Payment Testing'},{href:'/admin/webhook-events',label:'Webhook Events'},{href:'/admin/api-keys',label:'API Keys'},{href:'/admin/api-usage',label:'API Usage'},{href:'/admin/rate-limits',label:'Rate Limits'},{href:'/admin/webhook-endpoints',label:'Webhook Endpoints'},{href:'/admin/webhook-deliveries',label:'Webhook Deliveries'},{href:'/admin/tax-rates',label:'Tax Rates'},{href:'/admin/affiliates',label:'Affiliates'},{href:'/admin/partners',label:'Partners'},{href:'/admin/partner-offers',label:'Partner Offers'},{href:'/admin/sponsorships',label:'Sponsorships'},{href:'/admin/subscription-plans',label:'Subscription Plans'},{href:'/admin/recommendations',label:'Recommendations'},{href:'/admin/reports',label:'Reports'},{href:'/admin/surveys',label:'Surveys'},{href:'/admin/nps',label:'NPS'},{href:'/admin/course-views',label:'Course Views'},{href:'/admin/page-views',label:'Page Views'},{href:'/admin/waitlists',label:'Waitlists'},{href:'/admin/export',label:'Export Center'},{href:'/admin/import',label:'Import Center'},{href:'/admin/audit-logs',label:'Audit Logs'},{href:'/admin/notes',label:'Admin Notes'},{href:'/admin/maintenance',label:'Maintenance'},{href:'/admin/jobs',label:'Job Queue'},{href:'/admin/backups',label:'Backups'},{href:'/admin/cache',label:'Cache'},{href:'/admin/system-info',label:'System Info'},{href:'/admin/product-updates',label:'Product Updates'},{href:'/admin/license-activations',label:'License Activations'},{href:'/admin/database',label:'Database'},{href:'/admin/environment',label:'Environment'},{href:'/admin/roadmap',label:'Product Roadmap'},{href:'/admin/release-checklist',label:'Launch Checklist'},{href:'/admin/system-metrics',label:'System Metrics'},{href:'/admin/feature-flags',label:'Feature Flags'},{href:'/admin/experiments',label:'A/B Experiments'},{href:'/admin/email-templates',label:'Email Templates'},{href:'/admin/email-logs',label:'Email Logs'},{href:'/admin/integrations',label:'Integrations'},{href:'/admin/app-marketplace',label:'App Marketplace'},{href:'/admin/mobile-app',label:'Mobile App'},{href:'/admin/push-campaigns',label:'Push Campaigns'},{href:'/admin/content-rewrite',label:'Content Rewrite'},{href:'/admin/translation-jobs',label:'Translation Jobs'},{href:'/admin/automation-rules',label:'Automation Rules'},{href:'/admin/automation-runs',label:'Automation Runs'},{href:'/admin/settings',label:'Settings'},{href:'/admin/theme',label:'Theme'},{href:'/admin/theme/global',label:'Theme Tokens'},{href:'/admin/embed',label:'Embed Widgets'},{href:'/admin/white-label',label:'White Label'},{href:'/admin/onboarding',label:'Setup Wizard'},{href:'/admin/media',label:'Media Library'},{href:'/admin/support',label:'Support'},{href:'/admin/support-tags',label:'Support Tags'},{href:'/admin/sla',label:'SLA Policies'},{href:'/admin/knowledge-base',label:'Knowledge Base'},{href:'/admin/seed-guide',label:'Setup Guide'}
  ],
  instructor:[
    {href:'/instructor',label:'Dashboard'},{href:'/instructor/analytics',label:'Analytics'},{href:'/instructor/courses',label:'My Courses'},{href:'/instructor/courses/new',label:'Create Course'},{href:'/instructor/ai-course-ideas',label:'AI Course Ideas'},
    {href:'/instructor/availability',label:'Availability'},{href:'/instructor/bookings',label:'Bookings'},{href:'/instructor/live-sessions',label:'Live Sessions'},{href:'/instructor/cohorts',label:'Cohorts'},{href:'/instructor/mentor-programs',label:'Mentor Programs'},{href:'/instructor/coupons',label:'Coupons'},{href:'/instructor/resources',label:'Course Resources'},{href:'/instructor/milestones',label:'Milestones'},{href:'/instructor/payout-methods',label:'Payout Methods'},{href:'/instructor/students',label:'Students'},{href:'/instructor/quizzes',label:'Quiz Builder'},{href:'/instructor/drip',label:'Drip Content'},{href:'/instructor/assignments',label:'Assignments'},{href:'/instructor/submissions',label:'Submissions'},{href:'/instructor/questions',label:'Student Questions'},{href:'/instructor/reviews',label:'Reviews'},{href:'/instructor/faqs',label:'Course FAQs'},{href:'/instructor/course-announcements',label:'Course Announcements'},{href:'/instructor/notifications',label:'Notifications'},{href:'/instructor/earnings',label:'Earnings'}
  ],
  student:[
    {href:'/student',label:'Dashboard'},{href:'/student/my-courses',label:'My Courses'},{href:'/student/favorites',label:'Favorites'},{href:'/student/goals',label:'Goals'},{href:'/student/assignments',label:'Assignments'},{href:'/student/quizzes',label:'Quizzes'},{href:'/student/certificates',label:'Certificates'},{href:'/student/resources',label:'Resources & Notes'},{href:'/student/bookmarks',label:'Bookmarks'},{href:'/community',label:'Discussions'},{href:'/student/live-sessions',label:'Live Sessions'},{href:'/student/badges',label:'Achievements'},{href:'/student/notifications',label:'Notifications'},{href:'/student/preferences',label:'Preferences'},{href:'/student/privacy',label:'Privacy'}
  ]
};

const adminSectionDefinitions: NavSectionDefinition[] = [
  {
    title: 'Control Center',
    hrefs: ['/admin', '/admin/marketplace-health', '/admin/quick-actions']
  },
  {
    title: 'Users, Access & Compliance',
    hrefs: [
      '/admin/users', '/admin/privacy-requests', '/admin/data-retention', '/admin/consents', '/admin/cookie-categories',
      '/admin/dpa', '/admin/login-history', '/admin/organizations', '/admin/organization-members',
      '/admin/tenants', '/admin/tenant-members', '/admin/tenant-courses', '/admin/domains', '/admin/instructors'
    ]
  },
  {
    title: 'Courses & Learning',
    hrefs: [
      '/admin/courses', '/admin/categories', '/admin/learning-paths', '/admin/career-tracks', '/admin/jobs-board',
      '/admin/course-skills', '/admin/prerequisites', '/admin/course-licenses', '/admin/course-translations',
      '/admin/course-import-export', '/admin/scorm', '/admin/lti-tools', '/admin/live-sessions', '/admin/certificates',
      '/admin/certificate-templates', '/admin/badges', '/admin/instructor-badges'
    ]
  },
  {
    title: 'Commerce & Marketplace',
    hrefs: [
      '/admin/orders', '/admin/refunds', '/admin/invoice-templates', '/admin/withdrawals', '/admin/coupons', '/admin/coupon-redemptions',
      '/admin/bundles', '/admin/subscription-plans', '/admin/grants', '/admin/scholarships', '/admin/donations',
      '/admin/procurement', '/admin/purchase-orders', '/admin/vendors', '/admin/vendor-contracts', '/admin/tax-rates'
    ]
  },
  {
    title: 'Content, SEO & Home',
    hrefs: [
      '/admin/pages', '/admin/home-sections', '/admin/sliders', '/admin/blog', '/admin/seo', '/admin/seo-meta',
      '/admin/seo-redirects', '/admin/languages', '/admin/currencies', '/admin/media', '/admin/content-rewrite',
      '/admin/translation-jobs'
    ]
  },
  {
    title: 'Community & Moderation',
    hrefs: [
      '/admin/announcements', '/admin/notifications', '/admin/messages', '/admin/reviews', '/admin/instructor-reviews', '/admin/course-reports',
      '/admin/abuse-reports', '/admin/moderation-rules', '/admin/moderation-queue', '/admin/discussions',
      '/admin/surveys', '/admin/nps'
    ]
  },
  {
    title: 'Marketing & Growth',
    hrefs: [
      '/admin/affiliates', '/admin/partners', '/admin/partner-offers', '/admin/sponsorships', '/admin/recommendations',
      '/admin/push-campaigns', '/admin/product-updates', '/admin/roadmap'
    ]
  },
  {
    title: 'Payments, API & Integrations',
    hrefs: [
      '/admin/payment-methods', '/admin/payment-gateways', '/admin/payment-test', '/admin/webhook-events',
      '/admin/webhook-endpoints', '/admin/webhook-deliveries', '/admin/api-keys', '/admin/api-usage',
      '/admin/rate-limits', '/admin/integrations', '/admin/app-marketplace', '/admin/mobile-app', '/admin/embed'
    ]
  },
  {
    title: 'Analytics & Operations',
    hrefs: [
      '/admin/reports', '/admin/course-views', '/admin/page-views', '/admin/waitlists', '/admin/export', '/admin/import',
      '/admin/audit-logs', '/admin/notes', '/admin/automation-rules', '/admin/automation-runs'
    ]
  },
  {
    title: 'System & Launch',
    hrefs: [
      '/admin/maintenance', '/admin/jobs', '/admin/backups', '/admin/cache', '/admin/system-info', '/admin/system-metrics',
      '/admin/license-activations', '/admin/database', '/admin/environment', '/admin/release-checklist', '/admin/feature-flags',
      '/admin/experiments', '/admin/onboarding', '/admin/seed-guide'
    ]
  },
  {
    title: 'Settings & Support',
    hrefs: [
      '/admin/settings', '/admin/theme', '/admin/theme/global', '/admin/white-label', '/admin/email-templates', '/admin/email-logs',
      '/admin/support', '/admin/support-tags', '/admin/sla', '/admin/knowledge-base'
    ]
  }
];

export async function DashboardShell({ role, title, children }: { role: DashboardRole; title: string; children: ReactNode }) {
  const settings = await getSiteSettings();
  const copy = localizedCopy(settings.defaultLanguage);
  const isInstructor = role === 'instructor';
  const isStudent = role === 'student';
  const displayName = settings.siteName;
  const roleLabel = isInstructor ? 'Teacher' : isStudent ? 'Learning Platform' : copy.dashboard.roleLabels[role];
  const shellUser = isStudent ? await requireUser(['STUDENT']) : isInstructor ? await requireUser(['INSTRUCTOR']) : null;
  const [studentUnreadNotifications, studentUnreadMessages] = isStudent && shellUser
    ? await Promise.all([
        prisma.notification.count({ where: { userId: shellUser.id, read: false } }),
        prisma.message.count({ where: { senderId: { not: shellUser.id }, read: false, conversation: { userIds: listHas(shellUser.id) } } }),
      ])
    : [0, 0];
  const localizedTitle = localizedDashboardLabel(title, settings.defaultLanguage);
  const localizedItems = groups[role].map((item) => ({
    ...item,
    label: localizedDashboardLabel(item.label, settings.defaultLanguage)
  }));
  const localizedItemByHref = new Map(localizedItems.map((item) => [item.href, item]));
  const localizedSections = role === 'admin'
    ? adminSectionDefinitions
        .map((section) => ({
          title: localizedDashboardLabel(section.title, settings.defaultLanguage),
          items: section.hrefs
            .map((href) => localizedItemByHref.get(href))
            .filter((item): item is Item => Boolean(item))
        }))
        .filter((section) => section.items.length > 0)
    : undefined;

  return (
    <div className={`${isInstructor ? 'moe-dashboard-shell moe-instructor-redesign moe-instructor-shell' : isStudent ? 'moe-dashboard-shell moe-student-shell' : 'moe-dashboard-shell'} min-h-screen text-white`}>
      <div className={`grid min-h-screen ${isInstructor ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : isStudent ? 'lg:grid-cols-[286px_minmax(0,1fr)]' : 'lg:grid-cols-[304px_1fr]'}`}>
        <aside className="moe-sidebar min-w-0 overflow-hidden border-b p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <span className={`grid h-11 w-11 place-items-center rounded-xl border border-violet-300/30 text-white shadow-[0_0_28px_rgba(124,60,255,0.35)] ${isInstructor ? 'teacher-brand-mark' : isStudent ? 'student-brand-mark' : 'bg-gradient-to-br from-violet-600 to-indigo-700'}`}>
                {settings.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logoUrl} alt="" className="h-6 w-6 object-contain" />
                ) : (
                  <GraduationCap size={21} strokeWidth={1.8} />
                )}
              </span>
              <span>
                <span className="block text-base font-black leading-tight">{displayName}</span>
                <span className="block text-xs font-semibold text-slate-400">{roleLabel}</span>
              </span>
            </Link>
            <PanelLeft size={18} strokeWidth={1.8} className="text-[#8A949E] lg:hidden" />
          </div>

          <DashboardNav items={localizedItems} sections={localizedSections} rootHref={`/${role}`} label={copy.dashboard.navigationLabel[role]} />

          {isInstructor ? (
            <section className="mt-6 hidden rounded-xl border border-violet-400/20 bg-violet-600/15 p-4 md:block">
              <h2 className="text-sm font-black text-white">Quick Actions</h2>
              <div className="mt-4 grid gap-3 text-sm font-semibold">
                <Link href="/instructor/courses/new" className="flex items-center gap-2 text-slate-200 hover:text-white"><Plus size={15} /> Create New Course</Link>
                <Link href="/instructor/resources" className="flex items-center gap-2 text-slate-200 hover:text-white"><BookOpen size={15} /> Upload Content</Link>
                <Link href="/instructor/live-sessions" className="flex items-center gap-2 text-slate-200 hover:text-white"><CalendarDays size={15} /> Live Session</Link>
              </div>
            </section>
          ) : null}

          {isStudent ? (
            <section className="mt-6 hidden rounded-xl border border-violet-400/20 bg-violet-600/15 p-4 md:block">
              <h2 className="text-sm font-black text-white">Upgrade to Pro</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Unlock all features and get unlimited access.</p>
              <Link href="/pricing" className="mt-4 inline-flex h-10 items-center rounded-lg bg-violet-600 px-4 text-sm font-black text-white">
                <Trophy size={15} className="mr-2" />
                Upgrade Now
              </Link>
            </section>
          ) : null}

          <form action="/api/auth/logout" method="post" className="mt-6 border-t border-violet-300/15 pt-4">
            <CsrfInput />
            <button className="moe-control inline-flex h-10 w-full items-center justify-center gap-2 text-sm font-black">
              <LogOut size={16} />
              {copy.common.logout}
            </button>
          </form>

          {shellUser ? (
            <div className="mt-4 hidden rounded-xl border border-slate-700/70 bg-[#0b1323] p-4 sm:block">
              <div className="flex items-center gap-3">
                {shellUser.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shellUser.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-violet-600 text-sm font-black">{initials(shellUser.name)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">{shellUser.name}</p>
                  <p className="text-xs font-semibold text-slate-400">{isInstructor ? 'Course Instructor' : 'Student'}</p>
                </div>
                <Link href="/profile" className="text-slate-400 hover:text-white" aria-label="Profile">
                  <UserRound size={17} />
                </Link>
              </div>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          {isStudent ? (
            <div className="student-shell-header mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,480px)_auto] xl:items-center">
              <div>
                <p className="text-sm font-bold text-violet-300">Welcome back,</p>
                <h1 className="mt-1 text-3xl font-black leading-tight text-white">{localizedTitle}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-400">Keep learning and improving every day.</p>
              </div>
              <form action="/courses" className="hidden h-12 items-center gap-3 rounded-xl border border-slate-700 bg-[#0b1323] px-4 text-sm font-semibold text-slate-300 md:flex">
                <Search size={18} />
                <input name="q" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-500" placeholder="Search for courses, lessons..." />
              </form>
              <div className="flex items-center gap-3">
                <Link href="/student/notifications" aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-700/70 bg-[#0b1323] text-slate-300">
                  <Bell size={18} />
                  {studentUnreadNotifications ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{studentUnreadNotifications}</span> : null}
                </Link>
                <Link href="/messages" aria-label="Messages" className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-700/70 bg-[#0b1323] text-slate-300">
                  <MessageCircle size={18} />
                  {studentUnreadMessages ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{studentUnreadMessages}</span> : null}
                </Link>
                <Link href="/profile" aria-label="Profile" className="grid h-11 w-11 place-items-center rounded-full border border-slate-700/70 bg-[#0b1323] text-sm font-black text-white">
                  {shellUser ? initials(shellUser.name) : <UserRound size={18} />}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-violet-300">Welcome back,</p>
                <h1 className="mt-1 text-3xl font-black leading-tight">{localizedTitle}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-400">{roleLabel}</p>
              </div>
              <Link className="moe-control inline-flex h-10 w-fit items-center gap-2 px-4 text-sm font-black text-white" href="/">
                {copy.common.viewSite}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
          {children}
          {role === 'admin' && <AuthorCredit />}
        </main>
      </div>
    </div>
  );
}
