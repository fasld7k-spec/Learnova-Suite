import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function datetimeLocal(date: Date | null) {
  if (!date) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function Assignments() {
  const user = await requireUser(['INSTRUCTOR']);
  const courses = await prisma.course.findMany({ where: { instructorId: user.id }, orderBy: { title: 'asc' } });
  const lessonOptions = await prisma.lesson.findMany({
    where: { module: { courseId: { in: courses.map((course) => course.id) } } },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, type: true, module: { select: { title: true, courseId: true } } }
  });
  const assignments = await prisma.assignment.findMany({
    where: { courseId: { in: courses.map((course) => course.id) } },
    orderBy: { createdAt: 'desc' },
  });
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const lessonTitles = new Map(lessonOptions.map((lesson) => [lesson.id, `${lesson.title} (${lesson.module.title})`]));

  const lessonSelect = (defaultValue?: string | null) => (
    <select className="input" name="lessonId" defaultValue={defaultValue || ''}>
      <option value="">Course-wide assignment</option>
      {lessonOptions.map((lesson) => (
        <option key={lesson.id} value={lesson.id}>
          {courseTitles.get(lesson.module.courseId) || 'Course'} / {lesson.title} / {String(lesson.type)}
        </option>
      ))}
    </select>
  );

  return (
    <DashboardShell role="instructor" title="Assignments">
      <form className="card mb-6 grid gap-3" action="/api/instructor/assignments" method="post">
        <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        {lessonSelect()}
        <input className="input" name="title" placeholder="Assignment title" required />
        <textarea className="input min-h-28" name="description" placeholder="Instructions for students" required />
        <input className="input" type="datetime-local" name="dueAt" />
        <button className="btn-primary w-fit">Create Assignment</button>
      </form>

      <DataTable
        headers={['Title', 'Course', 'Lesson', 'Due', 'Created', 'Manage']}
        rows={assignments.map((assignment) => [
          assignment.title,
          courseTitles.get(assignment.courseId) || 'Archived course',
          assignment.lessonId ? lessonTitles.get(assignment.lessonId) || 'Archived lesson' : 'Course-wide',
          assignment.dueAt?.toLocaleString() || '-',
          assignment.createdAt.toLocaleDateString(),
          <details key="manage" className="min-w-72">
            <summary className="cursor-pointer text-sm font-bold text-[#1D9BF0]">Edit</summary>
            <form className="mt-3 grid gap-3 border border-[#2F3336] p-3" action="/api/instructor/assignments" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="update" />
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <select className="input" name="courseId" defaultValue={assignment.courseId} required>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              {lessonSelect(assignment.lessonId)}
              <input className="input" name="title" defaultValue={assignment.title} required />
              <textarea className="input min-h-24" name="description" defaultValue={assignment.description} required />
              <input className="input" type="datetime-local" name="dueAt" defaultValue={datetimeLocal(assignment.dueAt)} />
              <button className="btn-primary w-fit">Save Assignment</button>
            </form>
            <form className="mt-2" action="/api/instructor/assignments" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">Delete Assignment</button>
            </form>
          </details>
        ])}
      />
    </DashboardShell>
  );
}
