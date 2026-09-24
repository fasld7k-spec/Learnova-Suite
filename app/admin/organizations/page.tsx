import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Organizations() {
  await requireUser(['ADMIN']);
  const [organizations, users] = await Promise.all([
    prisma.organization.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, take: 500 })
  ]);
  const userLabels = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));

  return (
    <DashboardShell role="admin" title="Organizations">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/admin/organizations" method="post">
          <CsrfInput />
        <input className="input" name="name" placeholder="Organization name" required />
        <input className="input" name="slug" placeholder="organization-slug" required />
        <input className="input" name="logoUrl" placeholder="Logo URL or /path" />
        <select className="input" name="ownerId" required>
          <option value="">Select owner</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary">Create</button>
      </form>
      <DataTable
        headers={['Name', 'Slug', 'Owner', 'Active', 'Created', 'Manage']}
        rows={organizations.map((organization) => [
          organization.name,
          organization.slug,
          userLabels.get(organization.ownerId) || 'Archived owner',
          <Badge key="a" tone={organization.active ? 'green' : 'red'}>{organization.active ? 'Active' : 'Disabled'}</Badge>,
          organization.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/organizations" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={organization.id} />
              <input className="input" name="name" defaultValue={organization.name} />
              <input className="input" name="slug" defaultValue={organization.slug} />
              <input className="input" name="logoUrl" defaultValue={organization.logoUrl || ''} />
              <select className="input" name="ownerId" defaultValue={organization.ownerId}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input type="checkbox" name="active" defaultChecked={organization.active} /> Active
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/organizations" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={organization.id} />
                <button className="btn-secondary">{organization.active ? 'Disable' : 'Enable'}</button>
              </form>
              <form action="/api/admin/organizations" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={organization.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          </div>
        ])}
      />
    </DashboardShell>
  );
}
