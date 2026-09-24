import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const roles = ['OWNER', 'ADMIN', 'MANAGER', 'INSTRUCTOR', 'MEMBER', 'VIEWER'];

export default async function TenantMembers() {
  await requireUser(['ADMIN']);
  const [tenants, users, members] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, take: 1000 }),
    prisma.tenantMember.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const userLabels = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));

  return (
    <DashboardShell role="admin" title="Tenant Members">
      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <p className="text-xs font-bold uppercase text-[#71767B]">Tenant access</p>
        <h2 className="mt-1 text-2xl font-black text-white">Assign tenant members</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          Control who can access each branded portal and define owner, manager, instructor, member and viewer roles for white-label deployments.
        </p>
        <form className="mt-5 grid gap-3 md:grid-cols-4" action="/api/admin/tenant-members" method="post">
          <CsrfInput />
          <select className="input" name="tenantId" required>
            <option value="">Select tenant</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
          <select className="input" name="userId" required>
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
            ))}
          </select>
          <select className="input" name="role" defaultValue="MEMBER">
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button className="btn-primary">Add Member</button>
        </form>
      </section>

      <DataTable
        headers={['Tenant', 'User', 'Role', 'Created', 'Manage']}
        rows={members.map((member) => [
          tenantNames.get(member.tenantId) || 'Archived tenant',
          userLabels.get(member.userId) || 'Archived user',
          <Badge key="role" tone={member.role === 'OWNER' ? 'green' : member.role === 'VIEWER' ? 'slate' : 'yellow'}>{member.role}</Badge>,
          member.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/tenant-members" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={member.id} />
              <select className="input" name="tenantId" defaultValue={member.tenantId}>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
              <select className="input" name="userId" defaultValue={member.userId}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                ))}
              </select>
              <select className="input" name="role" defaultValue={member.role}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <form action="/api/admin/tenant-members" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={member.id} />
              <button className="btn-secondary border-red-400/40 text-red-200">Remove</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
