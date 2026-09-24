import { Megaphone, Radio, Send, UsersRound } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

const audienceLabels: Record<string, string> = {
  ALL: 'All users',
  STUDENT: 'Students',
  INSTRUCTOR: 'Instructors'
};

export default async function Announcements() {
  await requireUser(['ADMIN']);
  const [announcements, students, instructors] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'INSTRUCTOR' } })
  ]);

  const active = announcements.filter((announcement) => announcement.active);
  const globalAnnouncements = announcements.filter((announcement) => announcement.audience === 'ALL');
  const targetedAnnouncements = announcements.length - globalAnnouncements.length;

  return (
    <DashboardShell role="admin" title="Announcements">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Announcements" value={announcements.length} icon={<Megaphone size={18} />} />
        <StatCard label="Active" value={active.length} icon={<Radio size={18} />} />
        <StatCard label="Targeted" value={targetedAnnouncements} icon={<Send size={18} />} />
        <StatCard label="Audience users" value={students + instructors} icon={<UsersRound size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/announcements" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Broadcast center</p>
            <h2 className="mt-1 text-2xl font-black text-white">Publish a platform announcement</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Use announcements for launch notes, live class reminders, policy updates and targeted messages across student and instructor dashboards.
            </p>
          </div>
          <div className="grid gap-3">
            <input className="input" name="title" placeholder="Title" required />
            <textarea className="input min-h-28" name="body" placeholder="Announcement message" required />
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <select className="input" name="audience" defaultValue="ALL">
                <option value="ALL">All users</option>
                <option value="STUDENT">Students only</option>
                <option value="INSTRUCTOR">Instructors only</option>
              </select>
              <label className="flex items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
                <input type="checkbox" name="active" defaultChecked /> Active
              </label>
            </div>
          </div>
          <button className="btn-primary mt-4 w-fit">Publish Announcement</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Audience coverage</p>
          <h3 className="mt-1 text-xl font-black text-white">Delivery readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Student recipients</span>
              <Badge tone={students ? 'green' : 'yellow'}>{students}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Instructor recipients</span>
              <Badge tone={instructors ? 'green' : 'yellow'}>{instructors}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Global broadcasts</span>
              <Badge tone={globalAnnouncements.length ? 'green' : 'slate'}>{globalAnnouncements.length}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Message', 'Audience', 'Status', 'Date', 'Manage']}
          rows={announcements.map((announcement) => [
            <div key="message" className="max-w-xl">
              <p className="font-bold text-white">{announcement.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-[#71767B]">{announcement.body}</p>
            </div>,
            audienceLabels[announcement.audience] ?? announcement.audience,
            <Badge key="status" tone={announcement.active ? 'green' : 'red'}>{announcement.active ? 'Active' : 'Disabled'}</Badge>,
            announcement.createdAt.toLocaleDateString(),
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/announcements" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={announcement.id} />
                <input className="input" name="title" defaultValue={announcement.title} />
                <textarea className="input min-h-24" name="body" defaultValue={announcement.body} />
                <select className="input" name="audience" defaultValue={announcement.audience}>
                  <option value="ALL">All users</option>
                  <option value="STUDENT">Students only</option>
                  <option value="INSTRUCTOR">Instructors only</option>
                </select>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={announcement.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/announcements" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={announcement.id} />
                  <button className="btn-secondary">{announcement.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/announcements" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="resend" />
                  <input type="hidden" name="id" value={announcement.id} />
                  <button className="btn-secondary">Resend</button>
                </form>
                <form action="/api/admin/announcements" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={announcement.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
