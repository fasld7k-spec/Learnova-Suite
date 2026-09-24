import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function CourseFaqs() {
  const user = await requireUser(['INSTRUCTOR']);
  const courses = await prisma.course.findMany({ where: { instructorId: user.id }, orderBy: { title: 'asc' } });
  const rows = await prisma.courseFaq.findMany({ where: { courseId: { in: courses.map((course) => course.id) } }, orderBy: { sortOrder: 'asc' } });
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="instructor" title="Course FAQs">
      <form className="card mb-6 grid gap-3" action="/api/instructor/faqs" method="post">
        <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        <input className="input" name="question" placeholder="Question" required />
        <textarea className="input min-h-28" name="answer" placeholder="Answer" required />
        <input className="input" name="sortOrder" type="number" defaultValue={0} />
        <button className="btn-primary w-fit">Add FAQ</button>
      </form>
      <DataTable
        headers={['Question', 'Course', 'Sort']}
        rows={rows.map((row) => [row.question, courseTitles.get(row.courseId) || 'Archived course', row.sortOrder])}
      />
    </DashboardShell>
  );
}
