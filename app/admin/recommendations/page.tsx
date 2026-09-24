import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function Recommendations() {
  await requireUser(['ADMIN']);

  const [courses, rules, students, enrollments] = await Promise.all([
    prisma.course.findMany({ where: { status: 'PUBLISHED' } }),
    prisma.recommendationRule.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({ where: { role: 'STUDENT', status: 'APPROVED' }, select: { id: true } }),
    prisma.enrollment.findMany({ select: { userId: true, courseId: true } }),
  ]);
  const courseTitleById = new Map(courses.map((course) => [course.id, course.title]));
  const enrolledByStudent = new Map<string, Set<string>>();
  for (const enrollment of enrollments) {
    const set = enrolledByStudent.get(enrollment.userId) ?? new Set<string>();
    set.add(enrollment.courseId);
    enrolledByStudent.set(enrollment.userId, set);
  }

  function visibleStudentCount(courseIds: string[], audience: string) {
    if (audience === 'INSTRUCTOR') return 0;
    if (!courseIds.length) return 0;
    return students.filter((student) => {
      const enrolled = enrolledByStudent.get(student.id) ?? new Set<string>();
      return courseIds.some((courseId) => !enrolled.has(courseId));
    }).length;
  }
  const activeRules = rules.filter((rule) => rule.active).length;
  const recommendedCourseIds = new Set(rules.flatMap((rule) => fromJsonArray<string>(rule.courseIds)));

  return (
    <DashboardShell role="admin" title="Recommendations">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Rules" value={rules.length} />
        <StatCard label="Active rules" value={activeRules} />
        <StatCard label="Recommended courses" value={recommendedCourseIds.size} />
        <StatCard label="Eligible students" value={students.length} />
      </div>

      <form className="card mb-6 grid gap-3" action="/api/admin/recommendations" method="post">
        <CsrfInput />
        <input className="input" name="title" placeholder="Rule title" />
        <select className="input" name="courseIds" multiple>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        <select className="input" name="audience">
          <option>ALL</option>
          <option>STUDENT</option>
          <option>INSTRUCTOR</option>
        </select>
        <label className="flex gap-2">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Save Rule</button>
      </form>

      <DataTable
        headers={['Title', 'Audience', 'Courses', 'Visible to Students', 'Active', 'Manage']}
        rows={rules.map((rule) => {
          const selectedCourseIds = fromJsonArray<string>(rule.courseIds);
          const selectedTitles = selectedCourseIds.map((courseId) => courseTitleById.get(courseId)).filter(Boolean);

          return [
            rule.title,
            rule.audience,
            <div key="courses" className="grid gap-1 text-xs font-semibold text-[#71767B]">
              <span>{selectedCourseIds.length} selected</span>
              <span className="line-clamp-3">{selectedTitles.join(', ') || 'No published courses selected'}</span>
            </div>,
            visibleStudentCount(selectedCourseIds, rule.audience),
            <Badge key="active" tone={rule.active ? 'green' : 'red'}>
              {rule.active ? 'Active' : 'Disabled'}
            </Badge>,
            <div key="manage" className="grid min-w-[340px] gap-3">
              <form className="grid gap-2" action="/api/admin/recommendations" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={rule.id} />
                <input className="input" name="title" defaultValue={rule.title} aria-label="Rule title" />
                <select className="input" name="courseIds" multiple defaultValue={selectedCourseIds} aria-label="Recommended courses">
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                <select className="input" name="audience" defaultValue={rule.audience} aria-label="Audience">
                  <option value="ALL">ALL</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="INSTRUCTOR">INSTRUCTOR</option>
                </select>
                <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                  <input type="checkbox" name="active" defaultChecked={rule.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/recommendations" method="post">
                  <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={rule.id} />
                  <button className="btn-secondary">{rule.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/recommendations" method="post">
                  <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={rule.id} />
                  <button className="btn-secondary">Delete</button>
                </form>
              </div>
            </div>,
          ];
        })}
      />
    </DashboardShell>
  );
}
