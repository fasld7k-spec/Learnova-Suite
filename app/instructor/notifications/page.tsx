import Link from 'next/link';
import { Bell, CheckCheck, Mail, Settings } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { RealtimeNotificationInbox } from '@/components/notifications/RealtimeNotificationInbox';
import { requireUser } from '@/lib/auth';
import { getCsrfToken } from '@/lib/csrf';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

export default async function InstructorNotificationsPage() {
  const user = await requireUser(['INSTRUCTOR']);
  const [rows, preferences, settings, csrfToken] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    getSiteSettings(),
    getCsrfToken()
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);
  const unreadCount = rows.filter((notification) => !notification.read).length;

  return (
    <DashboardShell role="instructor" title="Notifications">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#8A949E]">{t('Unread')}</p>
            <Bell size={18} className="text-[#79C7FF]" />
          </div>
          <p className="mt-3 text-3xl font-black text-white">{unreadCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#8A949E]">{t('Email')}</p>
            <Mail size={18} className="text-[#79C7FF]" />
          </div>
          <p className="mt-3 text-lg font-black text-white">{preferences?.email ?? true ? t('Enabled') : t('Paused')}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#8A949E]">{t('Preferences')}</p>
            <Settings size={18} className="text-[#79C7FF]" />
          </div>
          <Link className="mt-3 inline-flex text-sm font-black text-[#79C7FF]" href="/profile">
            {t('Open settings')}
          </Link>
        </div>
      </div>

      <div className="ui-panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">{t('Activity inbox')}</h2>
          <p className="mt-1 text-sm text-[#8A949E]">{t('Course updates, payments, live sessions, and account messages appear here.')}</p>
        </div>
        {unreadCount > 0 ? (
          <form action="/api/notifications/read" method="post">
            <CsrfInput />
            <input type="hidden" name="all" value="true" />
            <input type="hidden" name="redirectTo" value="/instructor/notifications" />
            <button className="btn-primary">
              <CheckCheck size={16} />
              {t('Mark all read')}
            </button>
          </form>
        ) : null}
      </div>

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
    </DashboardShell>
  );
}
