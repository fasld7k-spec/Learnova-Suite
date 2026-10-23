import { BookOpenCheck, GraduationCap, ReceiptText, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const previewAccounts = [
  { role: 'Admin', email: 'admin@demo.com', icon: ShieldCheck },
  { role: 'Instructor', email: 'instructor@demo.com', icon: GraduationCap },
  { role: 'Student', email: 'student@demo.com', icon: UserRoundCheck }
];

export default async function SeedGuide() {
  await requireUser(['ADMIN']);
  const [users, courses, orders, certificates] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.order.count(),
    prisma.certificate.count()
  ]);
  const previewMode = process.env.DEMO_MODE === 'true';

  return (
    <DashboardShell role="admin" title="Setup Guide">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Users" value={users} />
        <StatCard label="Courses" value={courses} />
        <StatCard label="Orders" value={orders} />
        <StatCard label="Certificates" value={certificates} />
      </div>

      <section className="ui-panel mt-6 overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#2A3037] bg-[#101317] text-[#79C7FF]">
              <BookOpenCheck size={22} strokeWidth={1.8} />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#79C7FF]">Demo preview</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Use prepared preview accounts</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8A949E]">
              These seeded roles let you test admin operations, instructor publishing, and student learning without manual setup.
            </p>
          </div>

          <div className="grid gap-3">
            {previewAccounts.map((account) => {
              const Icon = account.icon;
              return (
                <div className="ui-panel-muted flex items-center justify-between gap-4 p-4" key={account.email}>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">{account.role}</p>
                    <p className="mt-1 break-all text-sm text-[#8A949E]">{account.email}</p>
                  </div>
                  <Icon className="shrink-0 text-[#79C7FF]" size={20} strokeWidth={1.8} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="ui-panel mt-6 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <ReceiptText className="text-[#79C7FF]" size={22} strokeWidth={1.8} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-white">Refresh seeded content</h2>
              <Badge tone={previewMode ? 'green' : 'yellow'}>{previewMode ? 'Preview data enabled' : 'Preview data disabled'}</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8A949E]">
              Refresh prepared preview records from the terminal during installation or QA. Browser-triggered database resets are not exposed in this package.
            </p>
          </div>
          <div className="grid gap-3">
            <pre className="overflow-auto rounded-md border border-[#2A3037] bg-[#050608] p-4 text-sm text-white">npm run prisma:seed</pre>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
