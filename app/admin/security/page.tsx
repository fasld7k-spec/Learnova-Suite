import Image from 'next/image';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { getContentProtectionSettings } from '@/lib/content-protection';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export default async function ContentSecuritySettings() {
  await requireUser(['ADMIN']);
  const [settings, siteSettings] = await Promise.all([getContentProtectionSettings(), getSiteSettings()]);
  const t = (label: string) => localizedDashboardLabel(label, siteSettings.defaultLanguage);
  const effectiveWatermarkLogo = settings.watermarkLogoUrl || siteSettings.logoUrl || siteSettings.faviconUrl || '/icon.svg';
  const [protectedLessons, resources, enrollments, recentEvents] = await Promise.all([
    prisma.lesson.count({ where: { OR: [{ videoUrl: { not: null } }, { attachmentUrl: { not: null } }] } }),
    prisma.courseResource.count(),
    prisma.enrollment.count(),
    prisma.auditLog.findMany({
      where: { OR: [{ action: { startsWith: 'media.access' } }, { action: 'security.settings.updated' }] },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);
  const actorIds = recentEvents.map((event) => event.actorId).filter(Boolean) as string[];
  const lessonIds = recentEvents.filter((event) => event.entity.toLowerCase() === 'lesson' && event.entityId).map((event) => event.entityId as string);
  const resourceIds = recentEvents.filter((event) => event.entity.toLowerCase() === 'resource' && event.entityId).map((event) => event.entityId as string);
  const [actors, lessons, courseResources] = await Promise.all([
    actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    lessonIds.length ? prisma.lesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    resourceIds.length ? prisma.courseResource.findMany({ where: { id: { in: resourceIds } }, select: { id: true, title: true } }) : Promise.resolve([])
  ]);
  const actorLabels = new Map(actors.map((actor) => [actor.id, `${actor.name} (${actor.email})`]));
  const lessonLabels = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const resourceLabels = new Map(courseResources.map((resource) => [resource.id, resource.title]));

  function securityEntityLabel(entity: string, entityId?: string | null) {
    if (!entityId) return entity;
    const key = entity.toLowerCase();
    if (key === 'lesson') return lessonLabels.get(entityId) || t('Archived lesson');
    if (key === 'resource') return resourceLabels.get(entityId) || t('Archived resource');
    if (key === 'setting') return t('Security settings');
    return entity;
  }

  return (
    <DashboardShell role="admin" title="Content Security">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label={t('Signed URLs')} value={settings.enabled && settings.signedUrls ? t('On') : t('Off')} />
        <StatCard label={t('URL TTL')} value={`${settings.ttlSeconds}s`} />
        <StatCard label={t('Protected lessons')} value={protectedLessons} />
        <StatCard label={t('Course resources')} value={resources} />
      </div>

      <form className="card mt-6 grid max-w-3xl gap-4" action="/api/admin/security" method="post" encType="multipart/form-data">
        <CsrfInput />
        <h2 className="text-xl font-black text-white">{t('Content Protection Controls')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
            {t('Enable content protection')}
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="signedUrls" defaultChecked={settings.signedUrls} />
            {t('Use expiring signed URLs')}
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="requireEnrollment" defaultChecked={settings.requireEnrollment} />
            {t('Require purchase/enrollment')}
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="allowPreviewLessons" defaultChecked={settings.allowPreviewLessons} />
            {t('Allow preview lessons')}
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="watermarkDownloads" defaultChecked={settings.watermarkDownloads} />
            {t('Show learner watermark')}
          </label>
          <label className="grid gap-1 text-sm font-bold text-[#E7E9EA]">
            {t('Signed URL TTL seconds')}
            <input className="input" name="ttlSeconds" type="number" min={60} max={86400} defaultValue={settings.ttlSeconds} />
          </label>
          <label className="grid gap-1 text-sm font-bold text-[#E7E9EA] md:col-span-2">
            {t('Watermark logo URL')}
            <input className="input" name="watermarkLogoUrl" placeholder={siteSettings.logoUrl || siteSettings.faviconUrl || '/icon.svg'} defaultValue={settings.watermarkLogoUrl} />
            <span className="text-xs font-semibold text-[#71767B]">{t('Leave empty to use the global site logo or favicon from General Settings.')}</span>
          </label>
          <label className="grid gap-1 text-sm font-bold text-[#E7E9EA] md:col-span-2">
            {t('Media signing secret')}
            <input className="input" name="signingSecret" type="password" autoComplete="new-password" placeholder={settings.signingSecret ? t('Saved - leave blank to keep current secret') : t('Optional secret for protected media tokens')} />
            <span className="text-xs font-semibold text-[#71767B]">{t('Use a long random value for production. Existing protected links expire quickly, so rotating this secret is safe after the TTL window.')}</span>
          </label>
          <label className="grid gap-1 text-sm font-bold text-[#E7E9EA] md:col-span-2">
            {t('Upload watermark logo')}
            <input className="input file:mr-4 file:rounded-full file:border-0 file:bg-[#1D9BF0] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white" name="watermarkLogoFile" type="file" accept="image/png,image/jpeg,image/webp" />
            <span className="text-xs font-semibold text-[#71767B]">{t('Uploading a file replaces the URL above with the stored asset URL. PNG, JPG, and WEBP are supported.')}</span>
          </label>
          <div className="flex items-center gap-3 rounded-3xl border border-[#2F3336] bg-[#050505] p-4 md:col-span-2">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-[#2F3336] bg-black">
              <Image src={effectiveWatermarkLogo} alt="" width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
            </div>
            <div>
              <p className="text-sm font-black text-white">{t('Current learner watermark')}</p>
              <p className="mt-1 text-xs font-semibold text-[#71767B]">{t('This logo appears as a small overlay on protected lesson viewers.')}</p>
            </div>
          </div>
        </div>
        <button className="btn-primary w-fit">{t('Save security settings')}</button>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="border border-[#2F3336] bg-black p-5">
          <h3 className="font-black text-white">{t('Lesson media')}</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">{t('Learner lesson video and attachment URLs are replaced with short-lived `/api/media/access` links.')}</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <h3 className="font-black text-white">{t('Resource checks')}</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">{t('The signing endpoint verifies enrollment before issuing links for downloadable course resources.')}</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5">
          <h3 className="font-black text-white">{t('Audit trail')}</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">{t('Allowed and denied media redemptions are written to audit logs for admin review.')}</p>
        </div>
        <div className="border border-[#2F3336] bg-black p-5 md:col-span-3">
          <h3 className="font-black text-white">{t('Logo watermark')}</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">{t('The lesson player uses a compact logo watermark from this page, then falls back to the platform logo or favicon if no custom protection logo is set.')}</p>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-xl font-black text-white">{t('Recent security events')}</h2>
      <DataTable
        headers={['Action', 'Entity', 'Actor', 'Status', 'Date'].map(t)}
        rows={recentEvents.map((event) => [
          event.action,
          securityEntityLabel(event.entity, event.entityId),
          event.actorId ? actorLabels.get(event.actorId) || t('System user') : t('System'),
          <Badge key="status" tone={event.action.endsWith('denied') ? 'red' : 'green'}>{event.action.endsWith('denied') ? t('Denied') : t('Allowed')}</Badge>,
          event.createdAt.toLocaleString()
        ])}
      />

      <div className="mt-6 border border-[#2F3336] bg-black p-5 text-sm leading-7 text-[#71767B]">
        <b className="text-white">{enrollments}</b> {t('active enrollments can redeem protected lesson media and resources when purchase checks are enabled.')}
      </div>
    </DashboardShell>
  );
}
