import { CalendarClock, ExternalLink, MonitorPlay, Radio } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { getAddonRuntime } from '@/lib/addons';

function datetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function AdminLive() {
  await requireUser(['ADMIN']);
  const now = new Date();
  const [sessions, instructors, courses, liveAddon] = await Promise.all([
    prisma.liveSession.findMany({ include: { course: true }, orderBy: { startsAt: 'desc' } }),
    prisma.user.findMany({ where: { role: 'INSTRUCTOR' }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }),
    prisma.course.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true, instructorId: true } }),
    getAddonRuntime('live-class-booking'),
  ]);
  const upcoming = sessions.filter((session) => session.startsAt >= now);
  const publicPreviews = sessions.filter((session) => session.isPreview || !session.courseId).length;
  const providers = new Set(sessions.map((session) => session.provider).filter(Boolean)).size;

  return (
    <DashboardShell role="admin" title="Live Sessions">
      {!liveAddon.active ? (
        <div className="mb-6 border border-[#FFD400] bg-black p-4 text-sm font-bold text-[#FFD400]">
          Live Class Booking add-on is disabled. Existing sessions remain visible for audit, but creating or editing sessions is locked.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Sessions" value={sessions.length} icon={<MonitorPlay size={18} />} />
        <StatCard label="Upcoming" value={upcoming.length} icon={<CalendarClock size={18} />} />
        <StatCard label="Public Previews" value={publicPreviews} icon={<Radio size={18} />} />
        <StatCard label="Providers" value={providers} icon={<ExternalLink size={18} />} />
      </div>

      <form className={`card mt-8 grid gap-4 ${liveAddon.active ? '' : 'opacity-60'}`} action="/api/admin/live-sessions" method="post">
        <CsrfInput />
        <input type="hidden" name="action" value="create" />
        <div>
          <h2 className="text-xl font-black text-white">Create Live Session</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Admin can create emergency webinars, public preview sessions, or instructor-backed classes without entering the instructor dashboard.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <input className="input" name="title" placeholder="Session title" required />
          <select className="input" name="instructorId" required>
            <option value="">Select instructor</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>{instructor.name} ({instructor.email})</option>
            ))}
          </select>
          <select className="input" name="courseId">
            <option value="">Standalone / public session</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input className="input" name="startsAt" type="datetime-local" required />
          <input className="input" name="durationMinutes" type="number" min="1" defaultValue="60" required />
          <select className="input" name="provider" defaultValue="EXTERNAL">
            <option value="EXTERNAL">External / manual link</option>
            <option value="ZOOM">Zoom auto-create</option>
            <option value="GOOGLE_MEET">Google Meet auto-create</option>
          </select>
        </div>
        <input className="input" name="url" placeholder="https://meeting.example.com/room - leave blank for configured Zoom/Google Meet" />
        <p className="text-xs font-semibold text-[#71767B]">
          Configure Zoom Server-to-Server OAuth or Google Calendar access token in Admin &gt; Integrations to auto-create meeting links.
        </p>
        <textarea className="input min-h-24" name="description" placeholder="Session description or joining notes" />
        <label className="flex items-center gap-3 text-sm font-bold text-[#E7E9EA]">
          <input type="checkbox" name="isPreview" />
          Open this session as a free public preview
        </label>
        <button className="btn-primary w-fit" disabled={!liveAddon.active}>Create Session</button>
      </form>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
        <DataTable
          headers={['Title', 'Course', 'Date', 'Duration', 'Access', 'Provider', 'URL', 'Actions']}
          rows={sessions.map((session) => [
            <span key="title" className="font-black">{session.title}</span>,
            session.course?.title || 'Standalone session',
            session.startsAt.toLocaleString(),
            `${session.durationMinutes} min`,
            <Badge key="access" tone={session.isPreview || !session.courseId ? 'green' : 'yellow'}>{session.isPreview || !session.courseId ? 'Public preview' : 'Enrolled only'}</Badge>,
            session.provider,
            <a key="url" href={session.url} className="inline-flex items-center gap-2 text-[#1D9BF0]" target="_blank" rel="noreferrer">Open <ExternalLink size={14} /></a>,
            <div key="actions" className="grid min-w-[560px] gap-3">
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/live-sessions" method="post">
                  <CsrfInput />
                  <input type="hidden" name="action" value="toggle-preview" />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button className="btn-secondary text-xs" disabled={!liveAddon.active}>{session.isPreview ? 'Lock preview' : 'Make preview'}</button>
                </form>
                <form action="/api/admin/live-sessions" method="post">
                  <CsrfInput />
                  <input type="hidden" name="action" value="delete" />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
                </form>
              </div>
              <details className="ui-panel-muted p-3" open={false}>
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-[#79C7FF]">Edit session</summary>
                <form className={`mt-3 grid gap-3 ${liveAddon.active ? '' : 'pointer-events-none opacity-50'}`} action="/api/admin/live-sessions" method="post">
                  <CsrfInput />
                  <input type="hidden" name="action" value="update" />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs font-bold text-[#D7DEE4]">
                      Title
                      <input className="input mt-1" name="title" defaultValue={session.title} required />
                    </label>
                    <label className="text-xs font-bold text-[#D7DEE4]">
                      Instructor
                      <select className="input mt-1" name="instructorId" defaultValue={session.instructorId} required>
                        {instructors.map((instructor) => (
                          <option key={instructor.id} value={instructor.id}>{instructor.name} ({instructor.email})</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-[#D7DEE4]">
                      Course
                      <select className="input mt-1" name="courseId" defaultValue={session.courseId || ''}>
                        <option value="">Standalone / public session</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-[#D7DEE4]">
                      Starts at
                      <input className="input mt-1" name="startsAt" type="datetime-local" defaultValue={datetimeLocalValue(session.startsAt)} required />
                    </label>
                    <label className="text-xs font-bold text-[#D7DEE4]">
                      Duration
                      <input className="input mt-1" name="durationMinutes" type="number" min="1" defaultValue={session.durationMinutes} required />
                    </label>
                    <label className="text-xs font-bold text-[#D7DEE4]">
                      Provider
                      <select className="input mt-1" name="provider" defaultValue={session.provider || 'EXTERNAL'}>
                        <option value="EXTERNAL">External / manual link</option>
                        <option value="ZOOM">Zoom auto-create</option>
                        <option value="GOOGLE_MEET">Google Meet auto-create</option>
                      </select>
                    </label>
                  </div>
                  <label className="text-xs font-bold text-[#D7DEE4]">
                    Meeting URL
                    <input className="input mt-1" name="url" defaultValue={session.url} placeholder="Leave blank to create a fresh Zoom/Google Meet link" />
                  </label>
                  <label className="text-xs font-bold text-[#D7DEE4]">
                    Description
                    <textarea className="input mt-1 min-h-20" name="description" defaultValue={session.description || ''} />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#D7DEE4]">
                    <input type="checkbox" name="isPreview" defaultChecked={session.isPreview} />
                    Free public preview
                  </label>
                  <button className="btn-primary w-fit text-xs" disabled={!liveAddon.active}>Save session</button>
                </form>
              </details>
            </div>,
          ])}
        />

        <aside className="h-fit border border-[#2F3336] bg-black p-5">
          <h2 className="text-xl font-black text-white">Reviewer checks</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[#71767B]">
            <p>Sessions show whether access is public preview or enrollment-only.</p>
            <p>Admin can audit provider names, course mapping and meeting URLs from one screen.</p>
            <p>Admin can create, edit, reschedule, switch providers, open previews, lock previews and delete invalid sessions.</p>
          </div>
          <div className="mt-5 grid gap-3">
            <a className="btn-secondary justify-center" href="/instructor/live-sessions">Instructor session tools</a>
            <a className="btn-secondary justify-center" href="/live-sessions">Public live page</a>
          </div>
        </aside>
      </section>
    </DashboardShell>
  );
}
