import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

function CourseMultiSelect({ courses, selected = [] }: { courses: { id: string; title: string }[]; selected?: string[] }) {
  return (
    <select className="input min-h-44" name="courseIds" multiple defaultValue={selected}>
      {courses.map((course) => (
        <option key={course.id} value={course.id}>{course.title}</option>
      ))}
    </select>
  );
}

export default async function Bundles() {
  await requireUser(['ADMIN']);

  const [bundles, courses, settings] = await Promise.all([
    prisma.courseBundle.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.course.findMany({ where: { status: 'PUBLISHED' }, orderBy: { title: 'asc' }, select: { id: true, title: true } }),
    getSiteSettings(),
  ]);
  const courseById = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Course Bundles">
      <form className="card mb-6 grid gap-3" action="/api/admin/bundles" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Bundle title" required />
        <input className="input" name="slug" placeholder="bundle-slug" />
        <textarea className="input min-h-28" name="description" placeholder="Description" />
        <input className="input" name="price" type="number" min="0" step="0.01" placeholder="Bundle price" required />
        <CourseMultiSelect courses={courses} />
        <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Save Bundle</button>
      </form>

      <DataTable
        headers={['Title', 'Slug', 'Courses', 'Price', 'Status', 'Manage']}
        rows={bundles.map((bundle) => {
          const selected = fromJsonArray<string>(bundle.courseIds);
          return [
            <div key="title" className="min-w-64">
              <p className="font-black text-white">{bundle.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[#71767B]">{bundle.description}</p>
            </div>,
            bundle.slug,
            <div key="courses" className="max-w-sm text-sm text-[#E7E9EA]">
              {selected.map((id) => courseById.get(id) || id).join(', ') || '-'}
            </div>,
            formatMoney(bundle.price, settings.currency),
            <Badge key="active" tone={bundle.active ? 'green' : 'red'}>{bundle.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-3">
              <details>
                <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
                <form className="mt-3 grid gap-2" action="/api/admin/bundles" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={bundle.id} />
                  <input className="input" name="title" defaultValue={bundle.title} required />
                  <input className="input" name="slug" defaultValue={bundle.slug} required />
                  <textarea className="input min-h-24" name="description" defaultValue={bundle.description} />
                  <input className="input" name="price" type="number" min="0" step="0.01" defaultValue={Number(bundle.price)} required />
                  <CourseMultiSelect courses={courses} selected={selected} />
                  <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked={bundle.active} /> Active</label>
                  <button className="btn-primary w-fit">Save</button>
                </form>
              </details>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/bundles" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={bundle.id} />
                  <input type="hidden" name="action" value="toggle" />
                  <input type="hidden" name="active" value={bundle.active ? 'false' : 'true'} />
                  <button className="btn-secondary">{bundle.active ? 'Disable' : 'Activate'}</button>
                </form>
                <form action="/api/admin/bundles" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={bundle.id} />
                  <input type="hidden" name="action" value="delete" />
                  <button className="btn-secondary">Delete</button>
                </form>
              </div>
            </div>,
          ];
        })}
      />
    </DashboardShell>
  );
}
