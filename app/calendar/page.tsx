import { CalendarDays, ExternalLink } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Calendar() {
  await requireUser();
  const sessions = await prisma.liveSession.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 100
  });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <CalendarDays className="text-violet-300" size={32} />
          <h1 className="mt-5 text-4xl font-black text-white">Calendar</h1>
          <p className="mt-3 max-w-2xl text-slate-300">Upcoming live sessions and scheduled learning events.</p>
        </div>
        </section>
        <section className="page-shell mt-8 grid gap-4">
          {sessions.map((session) => (
            <article className="moe-panel moe-card-shine p-5" key={session.id}>
              <h2 className="text-xl font-bold text-white">{session.title}</h2>
              <p className="mt-2 text-slate-400">
                {session.startsAt.toLocaleString()} - {session.durationMinutes} min
              </p>
              <a className="mt-4 inline-flex items-center gap-2 font-bold text-violet-200" href={session.url}>
                Join
                <ExternalLink size={16} />
              </a>
            </article>
          ))}
          {sessions.length === 0 && <p className="moe-panel p-6 text-slate-400">No upcoming sessions.</p>}
        </section>
      </main>
      <Footer />
    </>
  );
}
