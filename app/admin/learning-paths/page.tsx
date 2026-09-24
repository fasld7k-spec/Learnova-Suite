import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function LearningPaths() {
  await requireUser(['ADMIN']);

  const [paths, courses] = await Promise.all([
    prisma.learningPath.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.course.findMany({ where: { status: 'PUBLISHED' } }),
  ]);

  return (
    <DashboardShell role="admin" title="Learning Paths">
      <form className="card mb-6 grid gap-3" action="/api/admin/learning-paths" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Path title" />
        <input className="input" name="slug" placeholder="path-slug" />
        <textarea className="input" name="description" placeholder="Description" />
        <select className="input" name="courseIds" multiple>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        <label className="flex gap-2">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Save Path</button>
      </form>

      <DataTable
        headers={['Title', 'Slug', 'Courses', 'Active', 'Manage']}
        rows={paths.map((path) => [
          path.title,
          path.slug,
          fromJsonArray<string>(path.courseIds).length,
          <Badge key="active" tone={path.active ? 'green' : 'red'}>
            {path.active ? 'Active' : 'Disabled'}
          </Badge>,
          <div key="manage" className="grid min-w-96 gap-2">
            <form className="grid gap-2" action="/api/admin/learning-paths" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={path.id} />
              <input className="input" name="title" defaultValue={path.title} />
              <input className="input" name="slug" defaultValue={path.slug} />
              <textarea className="input min-h-24" name="description" defaultValue={path.description} />
              <select className="input" name="courseIds" multiple defaultValue={fromJsonArray<string>(path.courseIds)}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input type="checkbox" name="active" defaultChecked={path.active} /> Active
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/learning-paths" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={path.id} />
                <button className="btn-secondary">{path.active ? 'Disable' : 'Enable'}</button>
              </form>
              <form action="/api/admin/learning-paths" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={path.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
