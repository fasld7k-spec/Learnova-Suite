import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function CourseSkills() {
  await requireUser(['ADMIN']);
  const [courses, skills] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: 'asc' } }),
    prisma.courseOutcomeSkill.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Course Skills">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/admin/course-skills" method="post">
          <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <input className="input" name="skill" placeholder="Skill" required />
        <select className="input" name="level">
          <option>beginner</option>
          <option>intermediate</option>
          <option>advanced</option>
        </select>
        <button className="btn-primary">Add Skill</button>
      </form>
      <DataTable
        headers={['Course', 'Skill', 'Level', 'Manage']}
        rows={skills.map((skill) => [
          courseTitles.get(skill.courseId) || 'Archived course',
          skill.skill,
          skill.level,
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/course-skills" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={skill.id} />
              <select className="input" name="courseId" defaultValue={skill.courseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <input className="input" name="skill" defaultValue={skill.skill} />
              <select className="input" name="level" defaultValue={skill.level}>
                <option>beginner</option>
                <option>intermediate</option>
                <option>advanced</option>
              </select>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/course-skills" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={skill.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
