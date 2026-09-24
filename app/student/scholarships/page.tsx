import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function MyScholarships(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT']);
  const rows = await prisma.scholarshipApplication.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  const scholarships = rows.length
    ? await prisma.scholarship.findMany({
        where: { id: { in: rows.map((row) => row.scholarshipId) } },
        select: { id: true, title: true },
      })
    : [];
  const scholarshipTitles = new Map(scholarships.map((scholarship) => [scholarship.id, scholarship.title]));

  return (
    <DashboardShell role="student" title="Scholarship Applications">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      <DataTable
        headers={['Scholarship', 'Status', 'Date']}
        rows={rows.map((row) => [
          scholarshipTitles.get(row.scholarshipId) || 'Archived scholarship',
          <Badge key="s" tone={row.status === 'APPROVED' ? 'green' : row.status === 'PENDING' ? 'yellow' : 'red'}>{row.status}</Badge>,
          row.createdAt.toLocaleDateString(),
        ])}
      />
    </DashboardShell>
  );
}
