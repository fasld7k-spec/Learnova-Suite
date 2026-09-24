import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export default async function Preferences() {
  const user = await requireUser(['STUDENT']);
  const [preferences, settings] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    getSiteSettings()
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);

  return (
    <DashboardShell role="student" title="Notification Preferences">
      <form className="card grid max-w-xl gap-4" action="/api/student/preferences" method="post">
        <CsrfInput />
        <label className="flex gap-2">
          <input type="checkbox" name="email" defaultChecked={preferences?.email ?? true} />
          {t('Email notifications')}
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="inApp" defaultChecked={preferences?.inApp ?? true} />
          {t('In-app notifications')}
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="marketing" defaultChecked={preferences?.marketing ?? false} />
          {t('Marketing emails')}
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="liveReminders" defaultChecked={preferences?.liveReminders ?? true} />
          {t('Live session reminders')}
        </label>
        <button className="btn-primary w-fit">{t('Save Preferences')}</button>
      </form>
    </DashboardShell>
  );
}
