import { ArrowRight, CalendarClock, Clock3, MessageSquare } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function BookInstructor(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const instructor = await prisma.user.findFirst({ where: { id: params.id, role: 'INSTRUCTOR', status: 'APPROVED' } });
  if (!instructor) notFound();
  const availability = await prisma.instructorAvailability.findMany({
    where: { instructorId: instructor.id, active: true },
    orderBy: [{ weekday: 'asc' }, { startsAt: 'asc' }],
  });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft mx-auto grid max-w-6xl overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
          <section className="bg-white/[0.03] p-8 text-white">
            <div className="moe-panel flex h-full min-h-80 flex-col justify-between p-6">
              <div>
                <p className="text-sm font-bold text-violet-300">Instructor booking</p>
                <h1 className="mt-4 text-4xl font-black leading-tight">Book {instructor.name}</h1>
                <p className="mt-4 text-base leading-7 text-slate-300">Request a mentorship, coaching, or live guidance slot and include notes for the instructor.</p>
              </div>
              <div className="mt-8 rounded-lg border border-violet-300/15 bg-white/[0.04] p-4">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-slate-200">
                  <Clock3 size={16} />
                  Weekly availability
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {availability.map((slot) => `${weekdays[slot.weekday] || 'Weekly'} ${slot.startsAt}-${slot.endsAt}`).join(', ') || 'Contact instructor'}
                </p>
              </div>
            </div>
          </section>

          <form className="p-6 sm:p-10" action="/api/bookings" method="post">
            <CsrfInput />
            <input type="hidden" name="instructorId" value={instructor.id} />
            <h2 className="text-3xl font-black text-white">Request Booking</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Choose a proposed time and duration. The instructor can review and confirm the request.</p>
            {searchParams?.error ? (
              <p className="mt-5 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">{searchParams.error}</p>
            ) : null}
            {availability.length ? (
              <div className="moe-panel mt-6 grid gap-2 p-4 text-white">
                <p className="text-sm font-black">Available weekly slots</p>
                <div className="flex flex-wrap gap-2">
                  {availability.map((slot) => (
                    <span className="rounded-full border border-violet-300/15 px-3 py-1 text-xs font-bold text-slate-200" key={slot.id}>
                      {weekdays[slot.weekday] || 'Weekly'} {slot.startsAt}-{slot.endsAt}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="relative mt-8 block">
              <CalendarClock size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" name="startsAt" type="datetime-local" required />
            </label>
            <select className="input mt-3" name="durationMin" defaultValue="30" required>
              {[15, 30, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes}>{minutes} minutes</option>
              ))}
            </select>
            <label className="relative mt-3 block">
              <MessageSquare size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
              <textarea className="input min-h-36 pl-10" name="notes" placeholder="Notes" />
            </label>
            <button className="moe-primary mt-5 px-5 py-3">
              Request Booking
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
