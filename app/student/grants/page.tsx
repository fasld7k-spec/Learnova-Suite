import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function MyGrants(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT']);
  const applications = await prisma.grantApplication.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
  const grants = applications.length
    ? await prisma.grantProgram.findMany({ where: { id: { in: applications.map((row) => row.grantId) } } })
    : [];
  const grantTitles = new Map(grants.map((grant) => [grant.id, grant.title]));

  return (
    <DashboardShell role="student" title="Grant Applications">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      <DataTable
        headers={['Grant', 'Status', 'Date']}
        rows={applications.map((row) => [
          grantTitles.get(row.grantId) || 'Archived grant',
          <Badge key="s" tone={row.status === 'APPROVED' ? 'green' : row.status === 'PENDING' ? 'yellow' : 'red'}>{row.status}</Badge>,
          row.createdAt.toLocaleDateString()
        ])}
      />
    </DashboardShell>
  );
}
