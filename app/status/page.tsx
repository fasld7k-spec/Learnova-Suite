import { Activity, AlertTriangle, CheckCircle2, Database, Server } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

async function getPublicStatus() {
  try {
    const settings = await getSiteSettings();
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      appName: settings.siteName,
      checks: [
        { name: 'Web app', status: 'Responding', icon: Activity },
        { name: 'Health endpoint', status: 'Available at /api/health', icon: Server },
        { name: 'Database', status: 'Connected', icon: Database }
      ]
    };
  } catch {
    return {
      ok: false,
      appName: 'This installation',
      checks: [
        { name: 'Web app', status: 'Responding', icon: Activity },
        { name: 'Health endpoint', status: 'Review /api/health for details', icon: Server },
        { name: 'Database', status: 'Unavailable', icon: Database }
      ]
    };
  }
}

export default async function Status() {
  const status = await getPublicStatus();
  const StatusIcon = status.ok ? CheckCircle2 : AlertTriangle;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-5xl font-black text-white">System Status</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                Public status is generated from the current {status.appName} installation. Use /api/health for automated monitoring.
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-black ${status.ok ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/25 bg-amber-400/10 text-amber-200'}`}>
              <StatusIcon size={18} />
              {status.ok ? 'Connected' : 'Review needed'}
            </span>
          </div>
          </div>
        </section>

        <div className="page-shell mt-8 grid gap-5 md:grid-cols-3">
          {status.checks.map(({ name, status: checkStatus, icon: Icon }) => (
            <div className="moe-panel moe-card-shine p-5" key={name}>
              <span className="moe-mini-icon">
                <Icon size={22} />
              </span>
              <h2 className="mt-5 text-xl font-black text-white">{name}</h2>
              <p className={`mt-2 text-sm font-bold ${status.ok ? 'text-emerald-200' : 'text-amber-200'}`}>{checkStatus}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
