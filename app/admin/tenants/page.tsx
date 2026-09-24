import { Building2, GlobeLock, Layers3, UsersRound } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Tenants() {
  await requireUser(['ADMIN']);
  const [tenants, members, courses] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.tenantMember.findMany(),
    prisma.tenantCourse.findMany()
  ]);

  const active = tenants.filter((tenant) => tenant.active).length;
  const domains = tenants.filter((tenant) => tenant.domain).length;
  const memberCounts = new Map<string, number>();
  const courseCounts = new Map<string, number>();
  members.forEach((member) => {
    memberCounts.set(member.tenantId, (memberCounts.get(member.tenantId) ?? 0) + 1);
  });
  courses.forEach((course) => {
    courseCounts.set(course.tenantId, (courseCounts.get(course.tenantId) ?? 0) + 1);
  });

  return (
    <DashboardShell role="admin" title="Tenants">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tenants" value={tenants.length} icon={<Building2 size={18} />} />
        <StatCard label="Active" value={active} icon={<GlobeLock size={18} />} />
        <StatCard label="Members" value={members.length} icon={<UsersRound size={18} />} />
        <StatCard label="Assigned courses" value={courses.length} icon={<Layers3 size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/tenants" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Enterprise workspaces</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a tenant</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Tenants package branded learning portals for companies, schools and partner academies with their own domains and catalog assignments.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="name" placeholder="Tenant name" required />
            <input className="input" name="slug" placeholder="tenant-slug" required />
            <input className="input" name="domain" placeholder="custom domain" />
          </div>
          <label className="mt-3 flex gap-2 text-sm font-semibold text-slate-200">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Create Tenant</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Multi-tenant setup</p>
          <h3 className="mt-1 text-xl font-black text-white">Workspace readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Custom domains</span>
              <Badge tone={domains ? 'green' : 'yellow'}>{domains}/{tenants.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Member mapping</span>
              <Badge tone={members.length ? 'green' : 'yellow'}>{members.length ? 'Ready' : 'Missing'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Course mapping</span>
              <Badge tone={courses.length ? 'green' : 'yellow'}>{courses.length ? 'Ready' : 'Missing'}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Tenant', 'Slug', 'Domain', 'Members', 'Courses', 'Status', 'Manage']}
          rows={tenants.map((tenant) => [
            <div key="tenant">
              <p className="font-bold text-white">{tenant.name}</p>
              <p className="mt-1 text-xs text-[#71767B]">Created {tenant.createdAt.toLocaleDateString()}</p>
            </div>,
            <code key="slug" className="text-xs text-[#1D9BF0]">{tenant.slug}</code>,
            tenant.domain || '-',
            memberCounts.get(tenant.id) ?? 0,
            courseCounts.get(tenant.id) ?? 0,
            <Badge key="status" tone={tenant.active ? 'green' : 'red'}>{tenant.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/tenants" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={tenant.id} />
                <input className="input" name="name" defaultValue={tenant.name} />
                <input className="input" name="slug" defaultValue={tenant.slug} />
                <input className="input" name="domain" defaultValue={tenant.domain || ''} />
                <label className="flex gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={tenant.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/tenants" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={tenant.id} />
                  <button className="btn-secondary">{tenant.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/tenants" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={tenant.id} />
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
