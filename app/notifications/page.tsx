import Link from 'next/link';
import { Bell, CheckCheck, Mail, Settings } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { RealtimeNotificationInbox } from '@/components/notifications/RealtimeNotificationInbox';
import { requireUser } from '@/lib/auth';
import { getCsrfToken } from '@/lib/csrf';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser();
  const [rows, preferences, settings, csrfToken] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    getSiteSettings(),
    getCsrfToken()
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);
  const unreadCount = rows.filter((notification) => !notification.read).length;
  const preferenceHref = user.role === 'STUDENT' ? '/student/preferences' : '/profile';

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-300">{t('Activity inbox')}</p>
              <h1 className="mt-2 text-4xl font-black text-white">{t('Notifications')}</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                {t('Course updates, payments, live sessions, and account messages appear here.')}
              </p>
            </div>
            {unreadCount > 0 ? (
              <form action="/api/notifications/read" method="post">
                <CsrfInput />
                <input type="hidden" name="all" value="true" />
                <input type="hidden" name="redirectTo" value="/notifications" />
                <button className="moe-primary px-5 py-3">
                  <CheckCheck size={16} />
                  {t('Mark all read')}
                </button>
              </form>
            ) : null}
          </div>
        </div>
        </section>

        <section className="page-shell my-6 grid gap-4 md:grid-cols-3">
          <div className="moe-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-400">{t('Unread')}</p>
              <Bell size={18} className="text-violet-300" />
            </div>
            <p className="mt-3 text-3xl font-black text-white">{unreadCount}</p>
          </div>
          <div className="moe-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-400">{t('Email')}</p>
              <Mail size={18} className="text-violet-300" />
            </div>
            <p className="mt-3 text-lg font-black text-white">{preferences?.email ?? true ? t('Enabled') : t('Paused')}</p>
          </div>
          <div className="moe-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-400">{t('Preferences')}</p>
              <Settings size={18} className="text-violet-300" />
            </div>
            <Link className="mt-3 inline-flex text-sm font-black text-violet-200" href={preferenceHref}>
              {t('Open settings')}
            </Link>
          </div>
        </section>

        <section className="page-shell">
          <RealtimeNotificationInbox
            csrfToken={csrfToken}
            locale={settings.defaultLanguage}
            initialRows={rows.map((notification) => ({
              id: notification.id,
              title: notification.title,
              body: notification.body,
              read: notification.read,
              createdAt: notification.createdAt.toISOString()
            }))}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
