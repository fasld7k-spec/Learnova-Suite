import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function AutomationRules() {
  await requireUser(['ADMIN']);
  const rows = await prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="admin" title="Automation Rules">
      <form className="card mb-6 grid gap-3" action="/api/admin/automation-rules" method="post">
          <CsrfInput />
        <input className="input" name="name" placeholder="Rule name" required />
        <div className="grid gap-3 md:grid-cols-2">
          <select className="input" name="trigger" defaultValue="order.paid">
            <option value="order.paid">Order paid</option>
            <option value="course.published">Course published</option>
            <option value="student.inactive">Student inactive</option>
            <option value="ticket.opened">Ticket opened</option>
          </select>
          <select className="input" name="ruleAction" defaultValue="send.email">
            <option value="send.email">Send email</option>
            <option value="create.notification">Create notification</option>
            <option value="tag.user">Tag user</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" name="target" placeholder="Target audience or email" />
          <input className="input" name="message" placeholder="Message template" />
        </div>
        <label className="flex gap-2">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Save Rule</button>
      </form>
      <DataTable
        headers={['Name', 'Trigger', 'Action', 'Target', 'Active', 'Manage']}
        rows={rows.map((row) => {
          const config = fromJsonObject<{ target?: string; message?: string }>(row.config);
          return [
            row.name,
            row.trigger,
            row.action,
            config.target || '-',
            <Badge key="a" tone={row.active ? 'green' : 'red'}>
              {row.active ? 'Active' : 'Disabled'}
            </Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/automation-rules" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={row.id} />
                <input className="input" name="name" defaultValue={row.name} />
                <select className="input" name="trigger" defaultValue={row.trigger}>
                  <option value="order.paid">Order paid</option>
                  <option value="course.published">Course published</option>
                  <option value="student.inactive">Student inactive</option>
                  <option value="ticket.opened">Ticket opened</option>
                </select>
                <select className="input" name="ruleAction" defaultValue={row.action}>
                  <option value="send.email">Send email</option>
                  <option value="create.notification">Create notification</option>
                  <option value="tag.user">Tag user</option>
                </select>
                <input className="input" name="target" defaultValue={config.target || ''} />
                <input className="input" name="message" defaultValue={config.message || ''} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={row.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/automation-rules" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={row.id} />
                  <button className="btn-secondary">{row.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/automation-rules" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={row.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>,
          ];
        })}
      />
    </DashboardShell>
  );
}
