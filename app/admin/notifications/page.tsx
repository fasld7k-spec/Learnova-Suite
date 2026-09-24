import Link from 'next/link';
import { Bell, CheckCircle2, Mail, Radio, Send, UsersRound } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminNotifications({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const params = await searchParams;
  const [rows, unreadTotal, campaignCount, emailLogCount, allUsers] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.notification.count({ where: { read: false } }),
    prisma.pushNotificationCampaign.count(),
    prisma.emailLog.count().catch(() => 0),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 250, select: { id: true, name: true, email: true, role: true } })
  ]);
  const users = rows.length
    ? await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, name: true, email: true, role: true } })
    : [];
  const userNames = new Map(users.map((user) => [user.id, `${user.name} (${user.role.toLowerCase()})`]));
  const readTotal = rows.filter((row) => row.read).length;
  const affectedUsers = new Set(rows.map((row) => row.userId)).size;
  const messageNotifications = rows.filter((row) => /message|chat|reply/i.test(`${row.title} ${row.body}`)).length;

  return (
    <DashboardShell role="admin" title="Notifications">
      {params?.created && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-black text-emerald-200">
          Notification sent successfully.
        </div>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Recent notifications" value={rows.length} icon={<Bell size={18} />} />
        <StatCard label="Unread notifications" value={unreadTotal} icon={<Radio size={18} />} />
        <StatCard label="Push campaigns" value={campaignCount} icon={<Send size={18} />} />
        <StatCard label="Email logs" value={emailLogCount} icon={<Mail size={18} />} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Read confirmations" value={readTotal} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Affected users" value={affectedUsers} icon={<UsersRound size={18} />} />
        <StatCard label="Message alerts" value={messageNotifications} icon={<Bell size={18} />} />
      </div>

      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[#71767B]">Manual in-app notification</p>
            <h2 className="mt-1 text-xl font-black text-white">Send a notification now</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#71767B]">
              Send operational messages to one user, one role, or the whole platform. This uses the same notification table students and instructors see in their dashboards.
            </p>
          </div>
          <Badge tone="blue">{allUsers.length} users loaded</Badge>
        </div>
        <form action="/api/admin/notifications" method="post" className="mt-5 grid gap-3 lg:grid-cols-4">
          <CsrfInput />
          <input type="hidden" name="_action" value="create" />
          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#71767B]">
            Recipient
            <select name="recipientMode" className="input mt-2" defaultValue="user">
              <option value="user">Specific user</option>
              <option value="role">Role group</option>
              <option value="all">All users</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#71767B]">
            User
            <select name="userId" className="input mt-2">
              {allUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.email} - {user.role}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#71767B]">
            Role
            <select name="role" className="input mt-2" defaultValue="STUDENT">
              <option value="STUDENT">Students</option>
              <option value="INSTRUCTOR">Instructors</option>
              <option value="ADMIN">Admins</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#71767B]">
            Title
            <input className="input mt-2" name="title" placeholder="New lesson available" required />
          </label>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#71767B] lg:col-span-3">
            Message
            <textarea className="input mt-2 min-h-24" name="body" placeholder="Write the notification body shown inside the account area." required />
          </label>
          <div className="flex items-end">
            <button className="btn-primary w-full">
              <Bell size={16} />
              Send notification
            </button>
          </div>
        </form>
      </section>

      <div className="mb-6 flex flex-col gap-3 border border-[#2F3336] bg-black p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-[#71767B]">Notification operations</p>
          <h2 className="mt-1 text-xl font-black text-white">Notification control center</h2>
          <p className="mt-1 text-sm text-[#71767B]">
            Audit in-app notifications, monitor unread queues, inspect message alerts, and jump into campaign delivery tools from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action="/api/admin/notifications" method="post">
            <CsrfInput />
            <input type="hidden" name="_action" value="mark-all-read" />
            <button className="btn-secondary">Mark all read</button>
          </form>
          <form className="flex flex-wrap gap-2" action="/api/admin/notifications" method="post">
            <CsrfInput />
            <input type="hidden" name="_action" value="purge-read" />
            <input className="input h-10 w-24" name="days" type="number" min="1" defaultValue="90" aria-label="Purge read notification age in days" />
            <button className="btn-secondary border-red-400/40 text-red-200">Purge read</button>
          </form>
          <Link className="btn-primary" href="/admin/push-campaigns">
            <Send size={16} />
            Send campaign
          </Link>
          <Link className="btn-secondary" href="/admin/email-logs">
            <Mail size={16} />
            Email logs
          </Link>
        </div>
      </div>

      <DataTable
        headers={['User', 'Title', 'Body', 'Read', 'Date', 'Actions']}
        rows={rows.map((row) => [
          userNames.get(row.userId) || 'User',
          row.title,
          row.body,
          <Badge key="r" tone={row.read ? 'green' : 'yellow'}>{row.read ? 'Read' : 'Unread'}</Badge>,
          row.createdAt.toLocaleString(),
          <div key="actions" className="flex min-w-56 flex-wrap gap-2">
            {!row.read ? (
              <form action="/api/admin/notifications" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="mark-read" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary text-xs">Mark read</button>
              </form>
            ) : null}
            <form action="/api/admin/notifications" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={row.id} />
              <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
