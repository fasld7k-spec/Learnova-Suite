import Link from 'next/link';
import { BarChart3, Bell, DatabaseBackup, FolderPlus, ReceiptText, Settings, Tag, UploadCloud, Zap } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const actions = [
  { label: 'Create Course', href: '/admin/courses', description: 'Create or edit courses directly from the admin catalog manager.', icon: UploadCloud },
  { label: 'Create Category', href: '/admin/categories', description: 'Manage marketplace taxonomy and filters.', icon: FolderPlus },
  { label: 'Create Coupon', href: '/admin/coupons', description: 'Launch a discount code for checkout.', icon: Tag },
  { label: 'View Orders', href: '/admin/orders', description: 'Review payment status and invoices.', icon: ReceiptText },
  { label: 'Export Data', href: '/admin/export', description: 'Download CSV files for operations.', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', description: 'Configure branding, email, AI, storage, and auth.', icon: Settings },
];

export default async function QuickActions() {
  await requireUser(['ADMIN']);
  const [pendingCourses, openTickets, pendingOrders, failedJobs] = await Promise.all([
    prisma.course.count({ where: { status: 'PENDING' } }),
    prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }).catch(() => 0),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.jobQueue.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }).catch(() => 0),
  ]);

  return (
    <DashboardShell role="admin" title="Quick Actions">
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Pending courses" value={pendingCourses} icon={<UploadCloud size={18} />} />
        <StatCard label="Support workload" value={openTickets} icon={<Bell size={18} />} />
        <StatCard label="Pending orders" value={pendingOrders} icon={<ReceiptText size={18} />} />
        <StatCard label="Queued/failed jobs" value={failedJobs} icon={<Zap size={18} />} />
      </div>

      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#71767B]">One-click operations</p>
            <h2 className="mt-2 text-2xl font-black text-white">Run common admin tasks</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
              These shortcuts call the same backed admin endpoints used in the deeper modules, so buyers can verify real actions quickly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action="/api/admin/backups/run" method="post">
              <CsrfInput />
              <button className="btn-primary">
                <DatabaseBackup size={16} />
                Run backup
              </button>
            </form>
            <form action="/api/admin/onboarding" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="seed-launch-signoffs" />
              <button className="btn-secondary">Add launch sign-offs</button>
            </form>
            <a className="btn-secondary" href="/api/admin/reports/export">Reports CSV</a>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link className="card block transition hover:border-[#1D9BF0]" href={action.href} key={action.href}>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[#2F3336] text-[#1D9BF0]">
                <Icon size={19} />
              </span>
              <h2 className="mt-4 text-xl font-black text-white">{action.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[#71767B]">{action.description}</p>
            </Link>
          );
        })}
      </div>
    </DashboardShell>
  );
}
