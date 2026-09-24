import { Bell, Radio, Send } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function PushCampaigns({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const params = await searchParams;
  const rows = await prisma.pushNotificationCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const [users, unreadNotifications] = await Promise.all([
    prisma.user.count({ where: { status: 'APPROVED' } }),
    prisma.notification.count({ where: { read: false } })
  ]);
  const sentMessage = typeof params?.sent === 'string' ? params.sent : '';

  return (
    <DashboardShell role="admin" title="In-app Notification Campaigns">
      {sentMessage ? (
        <div className="mb-6 border border-[#00BA7C] bg-[#001F15] p-4 text-sm font-bold text-white">
          {sentMessage === 'already' ? 'Campaign was already sent.' : `Campaign created in-app notifications for ${sentMessage} users.`}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Approved users" value={users} icon={<Bell size={18} />} />
        <StatCard label="Campaigns" value={rows.length} icon={<Radio size={18} />} />
        <StatCard label="Unread in-app" value={unreadNotifications} icon={<Send size={18} />} />
      </div>

      <form className="card mb-6 grid gap-4" action="/api/admin/push-campaigns" method="post">
        <CsrfInput />
        <input type="hidden" name="action" value="create" />
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <input className="input" name="title" placeholder="Notification title" required />
          <select className="input" name="audience" defaultValue="ALL">
            <option value="ALL">All approved users</option>
            <option value="STUDENT">Students only</option>
            <option value="INSTRUCTOR">Instructors only</option>
            <option value="ADMIN">Admins only</option>
          </select>
        </div>
        <textarea className="input min-h-28" name="body" placeholder="Notification message" required />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="sendNow" />
            Send immediately and create in-app notifications
          </label>
          <button className="btn-primary">
            <Send size={17} />
            Create campaign
          </button>
        </div>
      </form>

      <DataTable
        headers={['Title', 'Audience', 'Status', 'Date', 'Action']}
        rows={rows.map((campaign) => [
          campaign.title,
          campaign.audience,
          <Badge key="s" tone={campaign.status === 'SENT' ? 'green' : campaign.status === 'QUEUED' ? 'blue' : 'yellow'}>
            {campaign.status}
          </Badge>,
          campaign.createdAt.toLocaleDateString(),
          campaign.status === 'SENT' ? (
            <span key="sent" className="text-xs font-bold text-[#71767B]">Created in-app</span>
          ) : (
            <form key="send" action="/api/admin/push-campaigns" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="send" />
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button className="btn-secondary">
                <Send size={15} />
                Send in-app
              </button>
            </form>
          )
        ])}
      />
    </DashboardShell>
  );
}
