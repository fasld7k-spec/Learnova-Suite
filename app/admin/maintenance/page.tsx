import Link from 'next/link';
import { Activity, ArchiveRestore, DatabaseBackup, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { productionEnvReadiness } from '@/lib/production-readiness';

function tone(ready: boolean) {
  return ready ? 'green' : 'yellow';
}

function databaseRuntime() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  if (/^postgres(ql)?:\/\//i.test(url)) return 'PostgreSQL';
  if (url.startsWith('file:')) return 'SQLite';
  return 'Custom';
}

export default async function Maintenance() {
  await requireUser(['ADMIN']);
  const [latestBackup, failedBackups, auditLogs, queuedJobs] = await Promise.all([
    prisma.backupLog.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.backupLog.count({ where: { status: 'FAILED' } }),
    prisma.auditLog.count().catch(() => 0),
    prisma.jobQueue.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }).catch(() => 0),
  ]);
  const readiness = productionEnvReadiness();
  const checks = [
    { label: 'JWT secret', ready: readiness.jwtReady, href: '/admin/release-checklist' },
    { label: 'Settings encryption', ready: readiness.settingsEncryptionReady, href: '/admin/release-checklist' },
    { label: 'Content protection', ready: readiness.contentProtectionReady, href: '/admin/security' },
    { label: 'Production switches', ready: readiness.productionSwitchesReady, href: '/admin/environment' },
    { label: 'Media allowlist', ready: readiness.mediaHostAllowlistReady, href: '/admin/security' },
  ];

  return (
    <DashboardShell role="admin" title="Maintenance">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Database" value={databaseRuntime()} icon={<ShieldCheck size={18} />} />
        <StatCard label="Latest backup" value={latestBackup ? latestBackup.status : 'None'} icon={<DatabaseBackup size={18} />} />
        <StatCard label="Failed backups" value={failedBackups} icon={<ArchiveRestore size={18} />} />
        <StatCard label="Queued/failed jobs" value={queuedJobs} icon={<Activity size={18} />} />
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-black text-white">Operations</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Run real maintenance actions from one place. Every sensitive operation is still routed through the underlying admin endpoint.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <form action="/api/admin/backups/run" method="post">
              <CsrfInput />
              <button className="btn-primary">
                <DatabaseBackup size={16} />
                Run backup
              </button>
            </form>
            <form action="/api/admin/cache/clear" method="post">
              <CsrfInput />
              <button className="btn-secondary">
                <Trash2 size={16} />
                Clear cache
              </button>
            </form>
            <a className="btn-secondary" href="/api/health">
              <Activity size={16} />
              Health check
            </a>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-black text-white">Security readiness</h2>
          <div className="mt-4 grid gap-3">
            {checks.map((check) => (
              <Link className="flex items-center justify-between gap-3 border border-[#2F3336] bg-black p-3 hover:border-[#1D9BF0]" href={check.href} key={check.label}>
                <span className="flex items-center gap-3 text-sm font-bold text-white">
                  <KeyRound size={16} className="text-[#1D9BF0]" />
                  {check.label}
                </span>
                <Badge tone={tone(check.ready)}>{check.ready ? 'Ready' : 'Needs review'}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link className="card block hover:border-[#1D9BF0]" href="/admin/backups">
          <h3 className="text-lg font-black text-white">Backup log</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Latest: {latestBackup ? `${latestBackup.status} / ${latestBackup.createdAt.toLocaleString()}` : 'No backup run recorded yet'}.
          </p>
        </Link>
        <Link className="card block hover:border-[#1D9BF0]" href="/admin/audit-logs">
          <h3 className="text-lg font-black text-white">Audit trail</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">{auditLogs} recorded admin and system events.</p>
        </Link>
        <Link className="card block hover:border-[#1D9BF0]" href="/admin/jobs">
          <h3 className="text-lg font-black text-white">Job queue</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Review pending, failed, and completed background work.</p>
        </Link>
      </section>
    </DashboardShell>
  );
}
