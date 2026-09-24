import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function InstructorBookings() {
  const user = await requireUser(['INSTRUCTOR']);
  const bookings = await prisma.booking.findMany({ where: { instructorId: user.id }, orderBy: { startsAt: 'desc' } });
  const students = bookings.length
    ? await prisma.user.findMany({ where: { id: { in: bookings.map((booking) => booking.studentId) } } })
    : [];
  const studentNames = new Map(students.map((student) => [student.id, student.name]));

  return (
    <DashboardShell role="instructor" title="Bookings">
      <DataTable
        headers={['Student', 'Date', 'Duration', 'Status', 'Action']}
        rows={bookings.map((booking) => [
          studentNames.get(booking.studentId) || 'Student',
          booking.startsAt.toLocaleString(),
          `${booking.durationMin} min`,
          <Badge key="s" tone={booking.status === 'APPROVED' ? 'green' : booking.status === 'PENDING' ? 'yellow' : 'red'}>
            {booking.status}
          </Badge>,
          <form key="a" action={`/api/instructor/bookings/${booking.id}/status`} method="post" className="flex min-w-72 flex-wrap gap-2">
            <CsrfInput />
            <select className="input max-w-40" name="status" defaultValue={booking.status}>
              <option>PENDING</option>
              <option>APPROVED</option>
              <option>REJECTED</option>
              <option>CANCELLED</option>
              <option>COMPLETED</option>
            </select>
            <input className="input min-w-44 flex-1" name="meetingUrl" placeholder="Meeting URL" defaultValue={booking.meetingUrl || ''} />
            <button className="btn-primary">Update</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
