import { BookOpenCheck, GraduationCap, Mail, Trophy } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';

export default async function InstructorStudents() {
  const user = await requireUser(['INSTRUCTOR']);
  const enrollments = await prisma.enrollment.findMany({
    where: { course: { instructorId: user.id } },
    include: { user: true, course: true },
    orderBy: { createdAt: 'desc' },
  });
  const uniqueStudents = new Set(enrollments.map((enrollment) => enrollment.userId)).size;
  const completed = enrollments.filter((enrollment) => enrollment.completedAt || enrollment.progress >= 100).length;
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((sum, enrollment) => sum + enrollment.progress, 0) / enrollments.length)
    : 0;

  return (
    <DashboardShell role="instructor" title="Students">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Unique Students" value={uniqueStudents} icon={<GraduationCap size={18} />} />
        <StatCard label="Enrollments" value={enrollments.length} icon={<BookOpenCheck size={18} />} />
        <StatCard label="Average Progress" value={`${avgProgress}%`} icon={<Trophy size={18} />} />
        <StatCard label="Completed" value={completed} icon={<Trophy size={18} />} />
      </div>

      <div className="mt-8">
        <DataTable
          headers={['Student', 'Email', 'Course', 'Progress', 'Status', 'Joined', 'Action']}
          rows={enrollments.map((enrollment) => [
            <span key="student" className="font-black">{enrollment.user.name}</span>,
            enrollment.user.email,
            <a key="course" className="text-[#1D9BF0]" href={`/instructor/courses/${enrollment.course.id}`}>{enrollment.course.title}</a>,
            `${enrollment.progress}%`,
            <Badge key="status" tone={enrollment.completedAt || enrollment.progress >= 100 ? 'green' : enrollment.progress > 0 ? 'blue' : 'yellow'}>
              {enrollment.completedAt || enrollment.progress >= 100 ? 'Completed' : enrollment.progress > 0 ? 'In progress' : 'Not started'}
            </Badge>,
            enrollment.createdAt.toLocaleDateString(),
            <a key="email" className="btn-secondary inline-flex items-center gap-2" href={`mailto:${enrollment.user.email}`}>
              <Mail size={15} />
              Email
            </a>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
