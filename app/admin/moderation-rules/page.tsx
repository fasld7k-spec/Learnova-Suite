import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function ModerationRules() {
  await requireUser(['ADMIN']);
  const rows = await prisma.contentModerationRule.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <DashboardShell role="admin" title="Moderation Rules">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/admin/moderation-rules" method="post">
          <CsrfInput />
        <input className="input" name="pattern" placeholder="blocked word / regex" required />
        <select className="input" name="action" defaultValue="FLAG">
          <option value="FLAG">FLAG</option>
          <option value="HIDE">HIDE</option>
          <option value="REJECT">REJECT</option>
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary">Save</button>
      </form>

      <DataTable
        headers={['Pattern', 'Action', 'Active', 'Date', 'Manage']}
        rows={rows.map((rule) => [
          rule.pattern,
          rule.action,
          <Badge key="active" tone={rule.active ? 'green' : 'red'}>{rule.active ? 'Active' : 'Disabled'}</Badge>,
          rule.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-72 gap-2">
            <form className="grid gap-2" action="/api/admin/moderation-rules" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={rule.id} />
              <input className="input" name="pattern" defaultValue={rule.pattern} />
              <select className="input" name="action" defaultValue={rule.action}>
                <option value="FLAG">FLAG</option>
                <option value="HIDE">HIDE</option>
                <option value="REJECT">REJECT</option>
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input type="checkbox" name="active" defaultChecked={rule.active} /> Active
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/moderation-rules" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={rule.id} />
                <button className="btn-secondary">{rule.active ? 'Disable' : 'Enable'}</button>
              </form>
              <form action="/api/admin/moderation-rules" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={rule.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
