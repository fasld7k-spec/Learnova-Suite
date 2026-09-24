import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const weekdays = [
  ['0', 'Sunday'],
  ['1', 'Monday'],
  ['2', 'Tuesday'],
  ['3', 'Wednesday'],
  ['4', 'Thursday'],
  ['5', 'Friday'],
  ['6', 'Saturday'],
] as const;

const weekdayLabel = (value: number) => weekdays.find(([key]) => Number(key) === value)?.[1] || 'Weekly';

export default async function Availability() {
  const user = await requireUser(['INSTRUCTOR']);
  const rows = await prisma.instructorAvailability.findMany({
    where: { instructorId: user.id },
    orderBy: [{ weekday: 'asc' }, { startsAt: 'asc' }],
  });

  return (
    <DashboardShell role="instructor" title="Availability">
      <section className="card mb-6">
        <h2 className="text-xl font-black text-white">Live lesson availability</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">
          These weekly slots appear on your public instructor profile and booking page. Keep inactive slots saved when you want to pause booking without deleting them.
        </p>
      </section>

      <form className="card mb-6 grid gap-3 md:grid-cols-5" action="/api/instructor/availability" method="post">
        <CsrfInput />
        <input type="hidden" name="action" value="create" />
        <select className="input" name="weekday" required>
          {weekdays.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input className="input" name="startsAt" placeholder="09:00" pattern="^([01]\d|2[0-3]):[0-5]\d$" required />
        <input className="input" name="endsAt" placeholder="17:00" pattern="^([01]\d|2[0-3]):[0-5]\d$" required />
        <input className="input" name="timezone" placeholder="Africa/Cairo" defaultValue="Africa/Cairo" />
        <button className="btn-primary">Add Slot</button>
      </form>

      <DataTable
        headers={['Day', 'Time', 'Timezone', 'Status', 'Edit']}
        rows={rows.map((slot) => [
          weekdayLabel(slot.weekday),
          `${slot.startsAt} - ${slot.endsAt}`,
          slot.timezone,
          <Badge key="status" tone={slot.active ? 'green' : 'red'}>{slot.active ? 'Active' : 'Paused'}</Badge>,
          <div key="edit" className="grid min-w-[520px] gap-2">
            <form className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]" action="/api/instructor/availability" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="update" />
              <input type="hidden" name="id" value={slot.id} />
              <select className="input" name="weekday" defaultValue={slot.weekday}>
                {weekdays.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input className="input" name="startsAt" defaultValue={slot.startsAt} pattern="^([01]\d|2[0-3]):[0-5]\d$" required />
              <input className="input" name="endsAt" defaultValue={slot.endsAt} pattern="^([01]\d|2[0-3]):[0-5]\d$" required />
              <input className="input" name="timezone" defaultValue={slot.timezone} />
              <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked={slot.active} /> Active
              </label>
              <button className="btn-primary md:col-span-5 w-fit">Save Changes</button>
            </form>
            <form action="/api/instructor/availability" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="id" value={slot.id} />
              <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">Delete Slot</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
