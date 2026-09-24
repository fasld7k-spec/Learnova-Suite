export const dynamic = 'force-dynamic';

import { CalendarDays, ExternalLink, Video } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { EmptyState } from '@/components/EmptyState';
import { getAddonRuntime } from '@/lib/addons';
import { localizedPageCopy } from '@/lib/page-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export default async function LiveSessions() {
  const [liveAddon, settings] = await Promise.all([
    getAddonRuntime('live-class-booking'),
    getSiteSettings(),
  ]);
  const sessions = liveAddon.active ? await prisma.liveSession.findMany({
    where: { startsAt: { gte: new Date() }, OR: [{ courseId: null }, { isPreview: true }] },
    orderBy: { startsAt: 'asc' },
    take: 50
  }) : [];
  const copy = localizedPageCopy(settings.defaultLanguage).catalog;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">{copy.liveTitle}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">{liveAddon.active ? copy.liveSubtitle : copy.noLiveBody}</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-4">
          {sessions.length ? sessions.map((session) => (
            <div className="moe-panel moe-card-shine p-5 transition hover:-translate-y-0.5" key={session.id}>
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-4">
                  <span className="moe-mini-icon h-12 w-12 shrink-0">
                    <Video size={22} />
                  </span>
                  <div>
                    <h2 className="text-xl font-black text-white">{session.title}</h2>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-400">
                      <CalendarDays size={15} />
                      {session.startsAt.toLocaleString()} / {session.durationMinutes} {copy.minutesShort} / {session.provider}
                    </p>
                    {session.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{session.description}</p>}
                  </div>
                </div>
                <form action="/api/student/live-sessions/join" method="post" target="_blank">
                  <CsrfInput />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button className="moe-primary shrink-0 px-5 py-3" type="submit">
                    {copy.join}
                    <ExternalLink size={16} />
                  </button>
                </form>
              </div>
            </div>
          )) : (
            <EmptyState title={copy.noLiveTitle} description={liveAddon.active ? copy.noLiveBody : 'Live sessions are currently disabled by the platform administrator.'} />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
