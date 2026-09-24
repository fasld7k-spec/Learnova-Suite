import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function StudentBookings(props: { searchParams?: Promise<{ requested?: string; cancelled?: string; rescheduled?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['STUDENT']);
  const bookings = await prisma.booking.findMany({ where: { studentId: user.id }, orderBy: { startsAt: 'desc' } });
  const instructors = bookings.length
    ? await prisma.user.findMany({ where: { id: { in: bookings.map((booking) => booking.instructorId) } } })
    : [];
  const instructorNames = new Map(instructors.map((instructor) => [instructor.id, instructor.name]));

  return (
    <DashboardShell role="student" title="My Bookings">
      {searchParams?.error ? (
        <div className="mb-6 border border-[#FFD400] bg-black p-4 text-sm font-bold text-[#FFD400]">{searchParams.error}</div>
      ) : searchParams?.requested ? (
        <div className="mb-6 border border-[#00BA7C] bg-black p-4 text-sm font-bold text-[#00BA7C]">Booking request sent successfully.</div>
      ) : searchParams?.cancelled ? (
        <div className="mb-6 border border-[#00BA7C] bg-black p-4 text-sm font-bold text-[#00BA7C]">Booking cancelled successfully.</div>
      ) : searchParams?.rescheduled ? (
        <div className="mb-6 border border-[#00BA7C] bg-black p-4 text-sm font-bold text-[#00BA7C]">Reschedule request sent successfully.</div>
      ) : null}
      <DataTable
        headers={['Instructor', 'Date', 'Duration', 'Meeting', 'Status', 'Manage']}
        rows={bookings.map((booking) => [
          instructorNames.get(booking.instructorId) || 'Instructor',
          booking.startsAt.toLocaleString(),
          `${booking.durationMin} min`,
          booking.meetingUrl ? (
            <a className="text-[#1D9BF0]" href={booking.meetingUrl} key="meeting">
              Join
            </a>
          ) : '-',
          <Badge key="s" tone={booking.status === 'APPROVED' ? 'green' : booking.status === 'PENDING' ? 'yellow' : 'red'}>
            {booking.status}
          </Badge>,
          <div key="manage" className="grid min-w-72 gap-2">
            {['PENDING', 'APPROVED'].includes(booking.status) ? (
              <>
                <details>
                  <summary className="btn-secondary inline-flex cursor-pointer text-xs">Reschedule</summary>
                  <form className="mt-2 grid gap-2 rounded-2xl border border-[#2F3336] bg-[#050505] p-3" action="/api/bookings" method="post">
                    <CsrfInput />
                    <input type="hidden" name="_action" value="reschedule" />
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="instructorId" value={booking.instructorId} />
                    <input className="input" name="startsAt" type="datetime-local" required />
                    <select className="input" name="durationMin" defaultValue={booking.durationMin}>
                      {[15, 30, 45, 60, 90, 120].map((duration) => <option key={duration} value={duration}>{duration} min</option>)}
                    </select>
                    <input className="input" name="notes" defaultValue={booking.notes || ''} placeholder="Reschedule note" />
                    <button className="btn-primary w-fit text-xs">Request new time</button>
                  </form>
                </details>
                <form action="/api/bookings" method="post">
                  <CsrfInput />
                  <input type="hidden" name="_action" value="cancel" />
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <button className="btn-secondary border-red-400/40 text-xs text-red-200">Cancel</button>
                </form>
              </>
            ) : '-'}
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
