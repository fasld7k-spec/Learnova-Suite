import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { addonBooleanSetting, addonNumberSetting, getAddonRuntime } from '@/lib/addons';

function datetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function InstructorLive(props: { searchParams?: Promise<{ error?: string; saved?: string }> }) {
  const user = await requireUser(['INSTRUCTOR']);
  const [courses, sessions, settings, liveAddon, searchParams] = await Promise.all([
    prisma.course.findMany({ where: { instructorId: user.id }, orderBy: { title: 'asc' } }),
    prisma.liveSession.findMany({ where: { instructorId: user.id }, orderBy: { startsAt: 'desc' } }),
    getSiteSettings(),
    getAddonRuntime('live-class-booking'),
    props.searchParams,
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const liveLessons = await prisma.lesson.findMany({
    where: { type: 'LIVE', module: { courseId: { in: courses.map((course) => course.id) } } },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, module: { select: { title: true, courseId: true } } }
  });
  const lessonLabels = new Map(liveLessons.map((lesson) => [lesson.id, `${lesson.title} (${lesson.module.title})`]));
  const defaultDuration = addonNumberSetting(liveAddon.settings, 'defaultSessionLength', 60);
  const allowFreePreview = addonBooleanSetting(liveAddon.settings, 'allowFreePreview', true);

  if (!liveAddon.active) {
    return (
      <DashboardShell role="instructor" title="Live Sessions">
        <section className="border border-[#2F3336] bg-black p-6">
          <h2 className="text-2xl font-black text-white">{t('Live Sessions')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
            The Live Class Booking add-on is disabled. Ask an admin to activate it from the Add-ons Center.
          </p>
          <a className="btn-primary mt-4 w-fit" href="/support">Contact support</a>
        </section>
      </DashboardShell>
    );
  }

  const courseSelect = (defaultValue?: string | null) => (
    <select className="input" name="courseId" defaultValue={defaultValue || ''}>
      <option value="">{t('Independent public session')}</option>
      {courses.map((course) => (
        <option key={course.id} value={course.id}>{course.title}</option>
      ))}
    </select>
  );
  const lessonSelect = (defaultValue?: string | null) => (
    <select className="input" name="lessonId" defaultValue={defaultValue || ''}>
      <option value="">{t('Course-wide live session')}</option>
      {liveLessons.map((lesson) => (
        <option key={lesson.id} value={lesson.id}>
          {courseTitles.get(lesson.module.courseId) || t('Course')} / {lesson.title}
        </option>
      ))}
    </select>
  );

  return (
    <DashboardShell role="instructor" title="Live Sessions">
      <form className="border border-[#2F3336] bg-black p-5" action="/api/instructor/live-sessions" method="post">
        <CsrfInput />
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">{t('Create live session')}</h2>
          <p className="mt-2 text-sm text-[#71767B]">{t('Schedule public previews or enrolled-only live classes tied to a course.')}</p>
        </div>
        {searchParams?.error ? <p className="mb-4 border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-bold text-amber-100">{searchParams.error}</p> : null}
        {searchParams?.saved ? <p className="mb-4 border border-[#00BA7C]/40 bg-[#00BA7C]/10 p-3 text-sm font-bold text-[#D7FBE8]">Live session saved.</p> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input" name="title" placeholder={t('Session title')} required />
          <input className="input" name="startsAt" type="datetime-local" required />
          <input className="input" name="durationMinutes" type="number" min={1} placeholder={t('Duration')} defaultValue={defaultDuration} required />
          <select className="input" name="provider">
            <option>EXTERNAL</option>
            <option>ZOOM</option>
            <option>GOOGLE_MEET</option>
          </select>
          <input className="input" name="url" placeholder={t('Meeting link required for External; optional for configured Zoom or Google Meet')} />
          {courseSelect()}
          {lessonSelect()}
        </div>
        <textarea className="input mt-3 min-h-24" name="description" placeholder={t('Session agenda or preparation notes')} />
        <label className="mt-3 flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
          <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="isPreview" disabled={!allowFreePreview} />
          {t('Free preview for visitors')}
        </label>
        {!allowFreePreview ? <p className="mt-2 text-xs font-bold text-[#FFD400]">Free previews are disabled by the active add-on settings.</p> : null}
        <button className="btn-primary mt-4">{t('Create Session')}</button>
      </form>

      <div className="mt-6">
        <DataTable
          headers={['Title', 'Course', 'Lesson', 'Date', 'Access', 'Provider', 'Manage'].map(t)}
          rows={sessions.map((session) => [
            session.title,
            session.courseId ? courseTitles.get(session.courseId) || t('Course') : t('Independent'),
            session.lessonId ? lessonLabels.get(session.lessonId) || t('Archived lesson') : t('Course-wide'),
            `${session.startsAt.toLocaleString()} / ${session.durationMinutes} min`,
            <Badge key="p" tone={session.isPreview || !session.courseId ? 'green' : 'yellow'}>{session.isPreview || !session.courseId ? t('Public preview') : t('Enrolled only')}</Badge>,
            session.provider,
            <details key="manage" className="min-w-72">
              <summary className="cursor-pointer text-sm font-bold text-[#1D9BF0]">{t('Edit')}</summary>
              <form className="mt-3 grid gap-3 border border-[#2F3336] p-3" action="/api/instructor/live-sessions" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="update" />
                <input type="hidden" name="sessionId" value={session.id} />
                <input className="input" name="title" defaultValue={session.title} required />
                <input className="input" name="startsAt" type="datetime-local" defaultValue={datetimeLocal(session.startsAt)} required />
                <input className="input" name="durationMinutes" type="number" min={1} defaultValue={session.durationMinutes} required />
                <select className="input" name="provider" defaultValue={session.provider}>
                  <option>EXTERNAL</option>
                  <option>ZOOM</option>
                  <option>GOOGLE_MEET</option>
                </select>
                <input className="input" name="url" defaultValue={session.url} placeholder={t('Meeting link / leave blank to create a new configured provider meeting')} />
                {courseSelect(session.courseId)}
                {lessonSelect(session.lessonId)}
                <textarea className="input min-h-20" name="description" defaultValue={session.description || ''} />
                <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                  <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="isPreview" defaultChecked={session.isPreview} disabled={!allowFreePreview} />
                  {t('Free preview')}
                </label>
                <button className="btn-primary w-fit">{t('Save Session')}</button>
              </form>
              <form className="mt-2" action="/api/instructor/live-sessions" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="sessionId" value={session.id} />
                <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">{t('Delete Session')}</button>
              </form>
            </details>
          ])}
        />
      </div>
    </DashboardShell>
  );
}
