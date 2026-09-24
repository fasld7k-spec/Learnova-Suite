import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function CourseLicenses() {
  await requireUser(['ADMIN']);
  const [courses, licenses, buyers] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: 'asc' } }),
    prisma.courseLicense.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, take: 500 }),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const buyerNames = new Map(buyers.map((buyer) => [buyer.id, buyer.name]));

  return (
    <DashboardShell role="admin" title="Course Licenses">
      <form className="card mb-6 grid gap-3 md:grid-cols-5" action="/api/admin/course-licenses" method="post">
          <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <select className="input" name="buyerId" required>
          <option value="">Select buyer</option>
          {buyers.map((buyer) => (
            <option key={buyer.id} value={buyer.id}>{buyer.name} - {buyer.email}</option>
          ))}
        </select>
        <select className="input" name="type">
          <option>B2B</option>
          <option>TEAM</option>
          <option>ENTERPRISE</option>
        </select>
        <input className="input" name="seats" type="number" min={1} defaultValue={1} />
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary">Create License</button>
      </form>
      <DataTable
        headers={['Course', 'Buyer', 'Type', 'Seats', 'Active', 'Manage']}
        rows={licenses.map((license) => [
          courseTitles.get(license.courseId) || 'Archived course',
          buyerNames.get(license.buyerId) || 'Buyer',
          license.type,
          license.seats,
          <Badge key="a" tone={license.active ? 'green' : 'red'}>{license.active ? 'Active' : 'Disabled'}</Badge>,
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/course-licenses" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={license.id} />
              <select className="input" name="courseId" defaultValue={license.courseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
              <select className="input" name="buyerId" defaultValue={license.buyerId}>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>{buyer.name} - {buyer.email}</option>
                ))}
              </select>
              <select className="input" name="type" defaultValue={license.type}>
                <option value="B2B">B2B</option>
                <option value="TEAM">TEAM</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
              <input className="input" name="seats" type="number" min={1} defaultValue={license.seats} />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input type="checkbox" name="active" defaultChecked={license.active} /> Active
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/course-licenses" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={license.id} />
                <button className="btn-secondary">{license.active ? 'Disable' : 'Enable'}</button>
              </form>
              <form action="/api/admin/course-licenses" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={license.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
