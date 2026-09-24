import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser, type Role } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { permissionLabels, permissions, roleLabels } from '@/lib/permissions';

const roles: Role[] = ['ADMIN', 'INSTRUCTOR', 'STUDENT'];
const statuses = ['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'];

function badgeTone(value: string) {
  if (value === 'APPROVED') return 'green';
  if (value === 'PENDING') return 'yellow';
  if (value === 'SUSPENDED' || value === 'REJECTED') return 'red';
  return 'slate';
}

function filterHref(key: string, value: string) {
  const params = new URLSearchParams();
  if (value) params.set(key, value);
  return `/admin/users${params.toString() ? `?${params}` : ''}`;
}

export default async function Users(
  props: { searchParams?: Promise<{ role?: string; status?: string; q?: string; error?: string }> }
) {
  const searchParams = await props.searchParams;
  const currentAdmin = await requireUser(['ADMIN']);

  const role = roles.includes(searchParams?.role as Role) ? (searchParams?.role as Role) : undefined;
  const status = statuses.includes(searchParams?.status || '') ? searchParams?.status : undefined;
  const q = searchParams?.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {})
  };

  const [users, counts] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } })
  ]);

  return (
    <DashboardShell role="admin" title="Users">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <form className="grid flex-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]" action="/admin/users">
              <input className="input" name="q" defaultValue={q} placeholder="Search name or email" />
              <select className="input" name="role" defaultValue={role || ''}>
                <option value="">All roles</option>
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </select>
              <select className="input" name="status" defaultValue={status || ''}>
                <option value="">All statuses</option>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button className="btn-primary">Filter</button>
            </form>
            <Link className="btn-secondary" href="/admin/users">
              Reset
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {roles.map((item) => (
              <Link key={item} href={filterHref('role', item)} className="btn border">
                {roleLabels[item]} ({counts.find((count) => count.role === item)?._count._all || 0})
              </Link>
            ))}
            <Link href={filterHref('status', 'SUSPENDED')} className="btn border">
              Suspended
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-black">Roles & Permissions</h2>
          <div className="mt-4 grid gap-3">
            {roles.map((item) => (
              <div key={item} className="border border-[#2F3336] p-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="blue">{roleLabels[item]}</Badge>
                  <span className="text-xs font-bold text-[#71767B]">{permissions[item].length} permissions</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {permissions[item].map((permission) => (
                    <span key={permission} className="rounded-full border border-[#2F3336] px-2.5 py-1 text-xs text-[#E7E9EA]">
                      {permissionLabels[permission]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DataTable
        headers={['Name', 'Email', 'Role', 'Status', 'Joined', 'Admin action']}
        rows={users.map((user) => [
          user.name,
          user.email,
          user.id === currentAdmin.id ? (
            <Badge key="role" tone="blue">ADMIN</Badge>
          ) : (
            <form key="role" action="/api/admin/users" method="post" className="flex min-w-[180px] gap-2">
              <CsrfInput />
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="action" value="setRole" />
              <select className="input" name="role" defaultValue={user.role}>
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button className="btn border">Save</button>
            </form>
          ),
          <Badge key="s" tone={badgeTone(user.status)}>
            {user.status}
          </Badge>,
          user.createdAt.toLocaleDateString(),
          user.id === currentAdmin.id ? (
            <Badge key="a" tone="blue">Current admin</Badge>
          ) : <div key="a" className="flex flex-wrap gap-2">
            <form action="/api/admin/users" method="post">
              <CsrfInput />
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="action" value={user.status === 'SUSPENDED' ? 'activate' : 'suspend'} />
              <button className={user.status === 'SUSPENDED' ? 'btn-primary' : 'btn border'}>
                {user.status === 'SUSPENDED' ? 'Reactivate' : 'Block'}
              </button>
            </form>
            <form action="/api/admin/users" method="post" className="flex gap-2">
              <CsrfInput />
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="action" value="setStatus" />
              <select className="input" name="status" defaultValue={user.status}>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button className="btn border">Update</button>
            </form>
          </div>
        ])}
      />
    </DashboardShell>
  );
}
