import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function JobApplications(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT']);
  const rows = await prisma.jobApplication.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  const jobs = rows.length
    ? await prisma.jobBoardPost.findMany({
        where: { id: { in: rows.map((application) => application.jobId) } },
        select: { id: true, title: true, company: true },
      })
    : [];
  const jobMap = new Map(jobs.map((job) => [job.id, `${job.title} at ${job.company}`]));

  return (
    <DashboardShell role="student" title="Job Applications">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      <DataTable
        headers={['Job', 'Status', 'Date']}
        rows={rows.map((application) => [
          jobMap.get(application.jobId) || 'Archived job post',
          <Badge key="s" tone={application.status === 'APPLIED' ? 'yellow' : 'green'}>{application.status}</Badge>,
          application.createdAt.toLocaleDateString(),
        ])}
      />
    </DashboardShell>
  );
}
