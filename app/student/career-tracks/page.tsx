import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function MyCareerTracks(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT']);
  const enrollments = await prisma.careerTrackEnrollment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
  const tracks = enrollments.length
    ? await prisma.careerTrack.findMany({ where: { id: { in: enrollments.map((row) => row.careerTrackId) } } })
    : [];
  const trackTitles = new Map(tracks.map((track) => [track.id, track.title]));

  return (
    <DashboardShell role="student" title="My Career Tracks">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      <DataTable
        headers={['Track', 'Status', 'Date']}
        rows={enrollments.map((row) => [
          trackTitles.get(row.careerTrackId) || 'Archived career track',
          <Badge key="s" tone={row.status === 'ACTIVE' ? 'green' : 'yellow'}>{row.status}</Badge>,
          row.createdAt.toLocaleDateString()
        ])}
      />
    </DashboardShell>
  );
}
