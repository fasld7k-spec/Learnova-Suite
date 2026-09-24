import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Devices() {
  const user = await requireUser(['STUDENT']);
  const devices = await prisma.userDevice.findMany({ where: { userId: user.id }, orderBy: { lastSeen: 'desc' } });

  return (
    <DashboardShell role="student" title="Devices">
      <form className="card mb-6 grid gap-3" action="/api/student/devices" method="post">
        <CsrfInput />
        <input className="input" name="name" placeholder="Device name" required />
        <p className="text-xs font-semibold leading-5 text-[#71767B]">
          Register trusted learner devices for account audit and device history. In-app notifications are delivered through the platform notification center.
        </p>
        <button className="btn-primary w-fit">Register Device</button>
      </form>
      <DataTable
        headers={['Name', 'Notification channel', 'Last Seen', 'Created']}
        rows={devices.map((device) => [
          device.name,
          'In-app',
          device.lastSeen.toLocaleString(),
          device.createdAt.toLocaleDateString(),
        ])}
      />
    </DashboardShell>
  );
}
