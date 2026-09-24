import Link from 'next/link';
import { Activity, DatabaseBackup, Download, HardDrive, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function databaseRuntime() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  if (/^postgres(ql)?:\/\//i.test(url)) return 'PostgreSQL';
  if (url.startsWith('file:')) return 'SQLite';
  return 'Custom';
}

function databaseSource() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  if (/^postgres(ql)?:\/\//i.test(url)) {
    return 'PostgreSQL connection configured';
  }
  if (!url.startsWith('file:')) return 'Custom database URL';
  return 'Local SQLite file configured';
}

function formatBytes(size: number | null) {
  if (size === null) return 'N/A';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

async function databaseSize() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  try {
    if (/^postgres(ql)?:\/\//i.test(url)) {
      const rows = await prisma.$queryRawUnsafe<Array<{ size: bigint | number }>>('SELECT pg_database_size(current_database()) AS size');
      return Number(rows[0]?.size || 0);
    }

    if (url.startsWith('file:')) {
      const pageCount = await prisma.$queryRawUnsafe<Array<{ page_count: bigint | number }>>('PRAGMA page_count');
      const pageSize = await prisma.$queryRawUnsafe<Array<{ page_size: bigint | number }>>('PRAGMA page_size');
      return Number(pageCount[0]?.page_count || 0) * Number(pageSize[0]?.page_size || 0);
    }

    return null;
  } catch {
    return null;
  }
}

export default async function DatabasePage() {
  await requireUser(['ADMIN']);

  const [
    users,
    courses,
    publishedCourses,
    orders,
    payments,
    enrollments,
    categories,
    coupons,
    reviews,
    notifications,
    supportTickets,
    emailLogs,
    auditLogs,
    pendingJobs,
    latestBackup,
    backupRuns,
    size,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.order.count(),
    prisma.payment.count(),
    prisma.enrollment.count(),
    prisma.category.count(),
    prisma.coupon.count(),
    prisma.review.count(),
    prisma.notification.count(),
    prisma.supportTicket.count(),
    prisma.emailLog.count().catch(() => 0),
    prisma.auditLog.count().catch(() => 0),
    prisma.jobQueue.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }).catch(() => 0),
    prisma.backupLog.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.backupLog.count(),
    databaseSize(),
  ]);
  const hasBackup = Boolean(latestBackup && latestBackup.status === 'SUCCESS');
  const tableRows = [
    ['Users', users, 'Accounts, roles, status, and access control data.'],
    ['Courses', courses, `${publishedCourses} published course(s).`],
    ['Categories', categories, 'Catalog taxonomy and marketplace filters.'],
    ['Orders', orders, 'Checkout records and invoice ownership.'],
    ['Payments', payments, 'Gateway transactions and manual/offline records.'],
    ['Enrollments', enrollments, 'Student access to purchased or assigned courses.'],
    ['Coupons', coupons, 'Admin and instructor discount codes.'],
    ['Reviews', reviews, 'Student ratings and moderation data.'],
    ['Notifications', notifications, 'In-app notifications and delivery history.'],
    ['Support tickets', supportTickets, 'Customer support cases and replies.'],
    ['Email logs', emailLogs, 'Transactional email delivery records.'],
    ['Audit logs', auditLogs, 'Sensitive admin and system events.'],
  ];

  return (
    <DashboardShell role="admin" title="Database Overview">
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Runtime" value={databaseRuntime()} icon={<ShieldCheck size={18} />} />
        <StatCard label="Database size" value={formatBytes(size)} icon={<HardDrive size={18} />} />
        <StatCard label="Tracked tables" value={tableRows.length} icon={<Activity size={18} />} />
        <StatCard label="Backup runs" value={backupRuns} icon={<DatabaseBackup size={18} />} />
        <StatCard label="Queued/failed jobs" value={pendingJobs} icon={<Activity size={18} />} />
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-[#2F3336] text-[#1D9BF0]">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-xl font-black text-white">Runtime database</h2>
              <p className="mt-2 text-sm leading-6 text-[#71767B]">
                Current runtime uses {databaseRuntime()}. The package includes SQLite-friendly local preview setup and PostgreSQL scripts for production deployments.
              </p>
              <code className="mt-4 block break-all rounded-md border border-[#2F3336] bg-[#050608] p-3 text-xs text-[#D7DEE4]">{databaseSource()}</code>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn-secondary w-fit" href="/admin/system-info">
                  View system info
                </Link>
                <a className="btn-secondary w-fit" href="/api/health">
                  Health check
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-[#2F3336] text-[#1D9BF0]">
              <DatabaseBackup size={20} />
            </span>
            <div>
              <h2 className="text-xl font-black text-white">Backup readiness</h2>
              <p className="mt-2 text-sm leading-6 text-[#71767B]">
                Latest backup: {latestBackup ? `${latestBackup.status} on ${latestBackup.createdAt.toLocaleString()}` : 'No backup run recorded yet'}.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={hasBackup ? 'green' : 'yellow'}>{hasBackup ? 'Backup ready' : 'Run backup'}</Badge>
                <form action="/api/admin/backups/run" method="post">
                  <CsrfInput />
                  <button className="btn-primary">
                    <DatabaseBackup size={16} />
                    Run backup now
                  </button>
                </form>
                <Link className="btn-secondary w-fit" href="/admin/backups">
                  Open backups
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Data Inventory</h2>
            <p className="mt-1 text-sm text-[#71767B]">Live row counts for the core buyer-facing and operational tables.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" href="/api/admin/export/users">
              <Download size={16} />
              Users CSV
            </a>
            <a className="btn-secondary" href="/api/admin/export/orders">
              <Download size={16} />
              Orders CSV
            </a>
            <a className="btn-secondary" href="/api/admin/export/courses">
              <Download size={16} />
              Courses CSV
            </a>
          </div>
        </div>
        <DataTable
          headers={['Table', 'Rows', 'Purpose']}
          rows={tableRows.map(([table, count, purpose]) => [
            <span className="font-black text-white" key="table">{table}</span>,
            <Badge key="count" tone={Number(count) > 0 ? 'green' : 'yellow'}>{count}</Badge>,
            purpose,
          ])}
        />
      </section>
    </DashboardShell>
  );
}
