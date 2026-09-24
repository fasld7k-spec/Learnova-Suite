import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Drip() {
  const user = await requireUser(['INSTRUCTOR']);
  const lessons = await prisma.lesson.findMany({
    where: { module: { course: { instructorId: user.id } } },
    include: { module: { include: { course: true } } },
    orderBy: { title: 'asc' },
  });
  const schedules = await prisma.dripSchedule.findMany({ where: { lessonId: { in: lessons.map((lesson) => lesson.id) } }, orderBy: { createdAt: 'desc' } });
  const lessonLabels = new Map(lessons.map((lesson) => [lesson.id, `${lesson.module.course.title} / ${lesson.title}`]));

  return (
    <DashboardShell role="instructor" title="Drip Content">
      <form className="card mb-6 grid gap-3 md:grid-cols-3" action="/api/instructor/drip" method="post">
        <CsrfInput />
        <select className="input" name="lessonId" required>
          <option value="">Select lesson</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>{lesson.module.course.title} / {lesson.title}</option>
          ))}
        </select>
        <input className="input" name="unlockDay" type="number" min={0} placeholder="Unlock after days" />
        <button className="btn-primary">Save Schedule</button>
      </form>
      <DataTable
        headers={['Lesson', 'Unlock Day', 'Created', 'Manage']}
        rows={schedules.map((schedule) => [
          lessonLabels.get(schedule.lessonId) || 'Archived lesson',
          schedule.unlockDay,
          schedule.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-64 gap-2">
            <form className="grid gap-2" action="/api/instructor/drip" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="update" />
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <select className="input" name="lessonId" defaultValue={schedule.lessonId} required>
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>{lesson.module.course.title} / {lesson.title}</option>
                ))}
              </select>
              <input className="input" name="unlockDay" type="number" min={0} defaultValue={schedule.unlockDay} />
              <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-white hover:bg-[#16181C]">Update</button>
            </form>
            <form action="/api/instructor/drip" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
