import { CalendarClock, ExternalLink, PlayCircle, Video } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { getAddonRuntime } from '@/lib/addons';

function accessLabel(sessionCourseId: string | null, enrolledCourseIds: string[]) {
  if (sessionCourseId && enrolledCourseIds.includes(sessionCourseId)) return { label: 'Enrolled', tone: 'green' as const };
  if (!sessionCourseId) return { label: 'Open event', tone: 'blue' as const };
  return { label: 'Free preview', tone: 'yellow' as const };
}

export default async function StudentLive(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT']);
  const [liveAddon, enrollments] = await Promise.all([
    getAddonRuntime('live-class-booking'),
    prisma.enrollment.findMany({
      where: { userId: user.id },
      include: { course: { select: { id: true, title: true } } }
    })
  ]);
  const enrolledCourseIds = enrollments.map((enrollment) => enrollment.courseId);
  const courseTitleById = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment.course.title]));
  const sessions = liveAddon.active ? await prisma.liveSession.findMany({
    where: {
      OR: [{ courseId: { in: enrolledCourseIds } }, { courseId: null }, { isPreview: true }],
      startsAt: { gte: new Date() }
    },
    orderBy: { startsAt: 'asc' }
  }) : [];
  const sessionLessonIds = sessions.map((session) => session.lessonId).filter((lessonId): lessonId is string => Boolean(lessonId));
  const sessionLessons = await prisma.lesson.findMany({
    where: { id: { in: sessionLessonIds } },
    select: { id: true, title: true }
  });
  const lessonTitleById = new Map(sessionLessons.map((lesson) => [lesson.id, lesson.title]));

  const enrolledSessions = sessions.filter((session) => session.courseId && enrolledCourseIds.includes(session.courseId)).length;
  const previewSessions = sessions.filter((session) => session.isPreview || !session.courseId).length;
  const nextSession = sessions[0];

  return (
    <DashboardShell role="student" title="Upcoming Live Sessions">
      {!liveAddon.active ? (
        <div className="mb-6 border border-[#2F3336] bg-black p-4 text-sm font-bold text-[#E7E9EA]">
          Live sessions are currently disabled by the platform administrator.
        </div>
      ) : searchParams?.error === 'disabled' ? (
        <div className="mb-6 border border-[#FFD400] bg-black p-4 text-sm font-bold text-[#FFD400]">
          Live sessions are not available right now.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Available sessions" value={sessions.length} icon={<Video size={18} />} />
        <StatCard label="Enrolled access" value={enrolledSessions} icon={<PlayCircle size={18} />} />
        <StatCard label="Preview/open" value={previewSessions} icon={<ExternalLink size={18} />} />
        <StatCard label="Enrolled courses" value={enrollments.length} icon={<CalendarClock size={18} />} />
      </div>

      {nextSession ? (
        <section className="mt-6 border border-[#2F3336] bg-black p-5">
          <p className="text-sm font-bold uppercase text-[#1D9BF0]">Next live class</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">{nextSession.title}</h2>
              <p className="mt-2 text-sm font-semibold text-[#71767B]">
                {(nextSession.lessonId ? lessonTitleById.get(nextSession.lessonId) : null) || (nextSession.courseId ? courseTitleById.get(nextSession.courseId) : 'Public event')} - {nextSession.startsAt.toLocaleString()}
              </p>
            </div>
            <form action="/api/student/live-sessions/join" method="post" target="_blank">
              <CsrfInput />
              <input type="hidden" name="sessionId" value={nextSession.id} />
              <button className="btn-primary w-fit">
              Join session
              <ExternalLink size={16} />
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-black text-white">Live Session Schedule</h2>
        <p className="mb-3 mt-1 text-sm font-semibold text-[#71767B]">Upcoming enrolled, preview and open sessions available to this learner.</p>
        <DataTable
          headers={['Session', 'Date', 'Duration', 'Access', 'Provider', 'Link']}
          rows={sessions.map((session) => {
            const access = accessLabel(session.courseId, enrolledCourseIds);
            return [
              <div key="session" className="min-w-[240px]">
                <p className="font-bold text-white">{session.title}</p>
                <p className="mt-1 text-xs font-semibold text-[#71767B]">
                  {session.lessonId && lessonTitleById.get(session.lessonId) ? `Lesson: ${lessonTitleById.get(session.lessonId)}` : session.courseId ? courseTitleById.get(session.courseId) : 'Public event'}
                </p>
              </div>,
              session.startsAt.toLocaleString(),
              `${session.durationMinutes} min`,
              <Badge key="access" tone={access.tone}>{access.label}</Badge>,
              session.provider,
              <form key="url" action="/api/student/live-sessions/join" method="post" target="_blank">
                <CsrfInput />
                <input type="hidden" name="sessionId" value={session.id} />
                <button className="text-brand-600" type="submit">Join</button>
              </form>
            ];
          })}
        />
      </section>
    </DashboardShell>
  );
}
