import Link from 'next/link';
import { Cpu, Database, Globe2, HardDrive, LockKeyhole, ServerCog } from 'lucide-react';

import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { productionEnvReadiness, productionReadinessRows } from '@/lib/production-readiness';
import { prisma } from '@/lib/prisma';
import { currentAppUrl } from '@/lib/request-url';
import { getSiteSettings } from '@/lib/site-settings';

function databaseRuntime() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  if (/^postgres(ql)?:\/\//i.test(url)) return 'PostgreSQL';
  if (url.startsWith('file:')) return 'SQLite';
  return 'Configured database';
}

function mask(value: string) {
  if (!value) return 'Not set';
  if (value.length <= 14) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default async function SystemInfo() {
  await requireUser(['ADMIN']);
  const [appUrl, settings, users, courses, orders, activeGateways] = await Promise.all([
    currentAppUrl(),
    getSiteSettings(),
    prisma.user.count().catch(() => 0),
    prisma.course.count().catch(() => 0),
    prisma.order.count().catch(() => 0),
    prisma.paymentMethod.count({ where: { active: true } }).catch(() => 0),
  ]);
  const readiness = productionEnvReadiness();
  const productionRows = productionReadinessRows();
  const productionReadyCount = productionRows.filter((row) => row.ready).length;
  const secretsReady = readiness.jwtReady && readiness.settingsEncryptionReady && readiness.contentProtectionReady;
  const storageReady = settings.storageProvider === 'local'
    ? process.env.NODE_ENV !== 'production' || settings.allowLocalUploads
    : Boolean(settings.storageBucket && settings.storageAccessKeyId && settings.storageSecretAccessKey);
  const emailReady = settings.emailProvider === 'log' || Boolean(settings.smtpHost && settings.smtpSender);

  const rows = [
    ['Application URL', appUrl, '/admin/domains'],
    ['Public configured URL', settings.publicAppUrl || 'Auto-detected', '/admin/settings'],
    ['Runtime mode', process.env.NODE_ENV || 'development', '/admin/environment'],
    ['Node.js', process.versions.node, '/admin/system-info'],
    ['Framework', 'Next.js 16', '/documentation'],
    ['Database ORM', 'Prisma', '/admin/database'],
    ['Active database', databaseRuntime(), '/admin/database'],
    ['Storage provider', settings.storageProvider, '/admin/settings'],
    ['Storage bucket', settings.storageBucket || 'Local filesystem', '/admin/settings'],
    ['Email provider', settings.emailProvider, '/admin/settings'],
    ['SMTP host', settings.smtpHost || 'Not configured', '/admin/settings'],
    ['AI provider', settings.aiProvider || 'demo', '/admin/settings'],
    ['Default language', `${settings.activeLanguageName} (${settings.defaultLanguage})`, '/admin/languages'],
    ['Currency', settings.currency, '/admin/currencies'],
    ['JWT secret', readiness.jwtReady ? 'Ready' : 'Needs production secret', '/admin/release-checklist'],
    ['Settings encryption', readiness.settingsEncryptionReady ? 'Ready' : 'Needs production key', '/admin/release-checklist'],
    ['Content protection', readiness.contentProtectionReady ? 'Ready' : 'Needs production key', '/admin/security'],
    ['Database URL fingerprint', mask(process.env.DATABASE_URL || ''), '/admin/database'],
  ];

  const checks = [
    { label: 'Secrets', ready: secretsReady, href: '/admin/release-checklist' },
    { label: 'Storage', ready: storageReady, href: '/admin/settings' },
    { label: 'Email', ready: emailReady, href: '/admin/settings' },
    { label: 'Payments', ready: activeGateways > 0, href: '/admin/payment-gateways' },
  ];

  return (
    <DashboardShell role="admin" title="System Info">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Users" value={users} icon={<Globe2 size={18} />} />
        <StatCard label="Courses" value={courses} icon={<HardDrive size={18} />} />
        <StatCard label="Orders" value={orders} icon={<Database size={18} />} />
        <StatCard label="Active gateways" value={activeGateways} icon={<LockKeyhole size={18} />} />
      </div>

      <section className="mt-6 border border-[#2F3336] bg-black p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Production preflight</h2>
            <p className="mt-1 text-sm text-[#71767B]">Same checks as the buyer-facing production readiness model, without exposing secrets.</p>
          </div>
          <Badge tone={productionReadyCount === productionRows.length ? 'green' : 'yellow'}>
            {productionReadyCount}/{productionRows.length} ready
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {productionRows.map((row) => (
            <Link className="border border-[#2F3336] p-3 transition hover:border-[#1D9BF0]" href="/admin/release-checklist" key={row.label}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[#E7E9EA]">{row.label}</span>
                <Badge tone={row.ready ? 'green' : 'yellow'}>{row.ready ? 'Ready' : 'Review'}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#71767B]">{row.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {checks.map((check) => (
          <Link className="border border-[#2F3336] bg-black p-4 transition hover:border-[#1D9BF0]" href={check.href} key={check.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-white">{check.label}</span>
              <Badge tone={check.ready ? 'green' : 'yellow'}>{check.ready ? 'Ready' : 'Review'}</Badge>
            </div>
          </Link>
        ))}
      </section>

      <div className="card mt-6">
        <div className="flex items-start gap-3">
          <ServerCog className="mt-1 shrink-0 text-[#1D9BF0]" size={22} />
          <div>
            <h2 className="text-xl font-black text-white">Runtime summary</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              This screen is generated from live environment variables, site settings, and database counts so buyers can verify an installation after changing domains, storage, payment, or email configuration.
            </p>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 md:grid-cols-2">
          {rows.map(([label, value, href]) => (
            <Link className="border border-[#2F3336] p-4 transition hover:border-[#1D9BF0]" href={href} key={label}>
              <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#71767B]">
                <Cpu size={14} />
                {label}
              </dt>
              <dd className="mt-2 break-words text-sm font-bold text-[#E7E9EA]">{value}</dd>
            </Link>
          ))}
        </dl>
      </div>
    </DashboardShell>
  );
}
