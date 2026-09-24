import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function TenantCourses() {
  await requireUser(['ADMIN']);
  const [tenants, courses, rows] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { name: 'asc' } }),
    prisma.course.findMany({ orderBy: { title: 'asc' } }),
    prisma.tenantCourse.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Tenant Courses">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/admin/tenant-courses" method="post">
          <CsrfInput />
        <select className="input" name="tenantId" required>
          <option value="">Select tenant</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
          ))}
        </select>
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" name="featured" /> Featured</label>
        <button className="btn-primary">Assign</button>
      </form>
      <DataTable
        headers={['Tenant', 'Course', 'Featured', 'Manage']}
        rows={rows.map((row) => [
          tenantNames.get(row.tenantId) || 'Tenant',
          courseTitles.get(row.courseId) || 'Archived course',
          <Badge key="f" tone={row.featured ? 'green' : 'slate'}>{row.featured ? 'Featured' : 'No'}</Badge>,
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/tenant-courses" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={row.id} />
              <select className="input" name="tenantId" defaultValue={row.tenantId}>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
              <select className="input" name="courseId" defaultValue={row.courseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input type="checkbox" name="featured" defaultChecked={row.featured} /> Featured
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/tenant-courses" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary">{row.featured ? 'Unfeature' : 'Feature'}</button>
              </form>
              <form action="/api/admin/tenant-courses" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Remove</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
