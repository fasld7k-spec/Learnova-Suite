import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function StudentMilestones() {
  const user = await requireUser(['STUDENT']);
  const enrollments = await prisma.enrollment.findMany({ where: { userId: user.id }, include: { course: true } });
  const milestones = await prisma.courseMilestone.findMany({ where: { courseId: { in: enrollments.map((enrollment) => enrollment.courseId) } }, orderBy: { sortOrder: 'asc' } });
  const courseTitles = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment.course.title]));

  return (
    <DashboardShell role="student" title="Milestones">
      <DataTable
        headers={['Title', 'Course', 'Action']}
        rows={milestones.map((milestone) => [
          milestone.title,
          courseTitles.get(milestone.courseId) || 'Archived course',
          <form key="a" action="/api/student/milestones/complete" method="post">
            <CsrfInput />
            <input type="hidden" name="milestoneId" value={milestone.id} />
            <button className="btn-primary">Mark Complete</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
