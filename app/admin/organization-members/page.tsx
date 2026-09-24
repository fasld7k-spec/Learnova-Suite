import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

const roles = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

export default async function OrganizationMembers() {
  await requireUser(['ADMIN']);
  const [organizations, users, members] = await Promise.all([
    prisma.organization.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, take: 1000 }),
    prisma.organizationMember.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const organizationNames = new Map(organizations.map((organization) => [organization.id, organization.name]));
  const userLabels = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));

  return (
    <DashboardShell role="admin" title="Organization Members">
      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <p className="text-xs font-bold uppercase text-[#71767B]">B2B access control</p>
        <h2 className="mt-1 text-2xl font-black text-white">Assign organization members</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          Add buyers, managers and viewers to organization accounts so enterprise course licenses, procurement requests and invoices stay connected to the right users.
        </p>
        <form className="mt-5 grid gap-3 md:grid-cols-4" action="/api/admin/organization-members" method="post">
          <CsrfInput />
          <select className="input" name="organizationId" required>
            <option value="">Select organization</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
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
        headers={['Organization', 'User', 'Role', 'Created', 'Manage']}
        rows={members.map((member) => [
          organizationNames.get(member.organizationId) || 'Archived organization',
          userLabels.get(member.userId) || 'Archived user',
          <Badge key="role" tone={member.role === 'OWNER' ? 'green' : member.role === 'VIEWER' ? 'slate' : 'yellow'}>{member.role}</Badge>,
          member.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/organization-members" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={member.id} />
              <select className="input" name="organizationId" defaultValue={member.organizationId}>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
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
            <form action="/api/admin/organization-members" method="post">
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
