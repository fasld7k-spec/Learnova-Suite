import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function EnvironmentControl() {
  await requireUser(['ADMIN']);
  const [users, courses, orders] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.order.count()
  ]);
  const previewMode = process.env.DEMO_MODE === 'true';
  const sandboxPayments = process.env.PAYMENT_SANDBOX_MODE === 'true';
  const productionRuntime = process.env.NODE_ENV === 'production';
  const releaseReady = !previewMode && !sandboxPayments;

  return (
    <DashboardShell role="admin" title="Environment Control">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Users" value={users} />
        <StatCard label="Courses" value={courses} />
        <StatCard label="Orders" value={orders} />
        <StatCard label="Runtime" value={process.env.NODE_ENV || 'development'} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-bold text-white">Environment status</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={previewMode ? (productionRuntime ? 'red' : 'yellow') : 'green'}>
              {previewMode ? 'Seeded preview data enabled' : 'Seeded preview data disabled'}
            </Badge>
            <Badge tone={sandboxPayments ? (productionRuntime ? 'red' : 'yellow') : 'green'}>
              {sandboxPayments ? 'Sandbox payments enabled' : 'Live payment mode'}
            </Badge>
            <Badge tone={releaseReady ? 'green' : 'yellow'}>
              {releaseReady ? 'Production switches ready' : 'Not production-ready'}
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#71767B]">
            This page summarizes installation status, payment mode, and the data profile currently active for this marketplace.
          </p>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-white">Seeded content</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Prepared content is managed from terminal commands during installation and QA. Browser-triggered database resets are intentionally not exposed in the production package.
          </p>
          <pre className="mt-4 overflow-auto rounded-md border border-[#2A3037] bg-[#050608] p-4 text-sm text-white">npm run prisma:seed</pre>
        </div>
      </div>
    </DashboardShell>
  );
}
