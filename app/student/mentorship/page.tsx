import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function MyMentorship(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT']);
  const rows = await prisma.mentorEnrollment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  const programs = rows.length
    ? await prisma.mentorProgram.findMany({
        where: { id: { in: rows.map((row) => row.programId) } },
        select: { id: true, title: true },
      })
    : [];
  const programMap = new Map(programs.map((program) => [program.id, program.title]));

  return (
    <DashboardShell role="student" title="My Mentorship">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      <DataTable
        headers={['Program', 'Status', 'Date']}
        rows={rows.map((row) => [
          programMap.get(row.programId) || 'Archived mentorship program',
          <Badge key="s" tone={row.status === 'ACTIVE' ? 'green' : 'yellow'}>{row.status}</Badge>,
          row.createdAt.toLocaleDateString(),
        ])}
      />
    </DashboardShell>
  );
}
