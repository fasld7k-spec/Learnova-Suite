import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

function CourseSelect({ courses, selected }: { courses: { id: string; title: string }[]; selected?: string }) {
  return (
    <select className="input" name="courseId" required defaultValue={selected || ''}>
      <option value="">Select course</option>
      {courses.map((course) => (
        <option key={course.id} value={course.id}>{course.title}</option>
      ))}
    </select>
  );
}

export default async function Scorm() {
  await requireUser(['ADMIN']);
  const [courses, rows, attempts] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true } }),
    prisma.scormPackage.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.scormAttempt.groupBy({ by: ['packageId'], _count: { id: true } }).catch(() => []),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const attemptCount = new Map(attempts.map((item) => [item.packageId, item._count.id]));

  return (
    <DashboardShell role="admin" title="SCORM-style Package Launcher/Tracking">
      <section className="card mb-6 border-amber-400/40 bg-amber-400/10">
        <p className="text-xs font-black uppercase text-amber-200">Launcher scope</p>
        <h2 className="mt-2 text-lg font-black text-white">Package launch links and basic attempt tracking</h2>
        <p className="mt-2 text-sm leading-6 text-[#E7E9EA]">
          Use this page to register SCORM-style package metadata, attach it to courses, launch the configured
          URL, and count learner attempts. A full SCORM 1.2/2004 runtime API, content package import/unzip,
          manifest sequencing, suspend data, score mapping, and LMS-grade runtime communication are not included.
        </p>
      </section>

      <form className="card mb-6 grid gap-3" action="/api/admin/scorm" method="post">
          <CsrfInput />
        <CourseSelect courses={courses} />
        <input className="input" name="title" placeholder="Package title" required />
        <input className="input" name="manifestUrl" placeholder="imsmanifest.xml URL or /path" required />
        <input className="input" name="launchUrl" placeholder="Launch URL or /path" required />
        <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked /> Active</label>
        <button className="btn-primary w-fit">Add Launch Package</button>
      </form>

      <DataTable
        headers={['Title', 'Course', 'Attempts', 'Status', 'Launch', 'Manage']}
        rows={rows.map((row) => [
          <div key="title" className="min-w-56">
            <p className="font-black text-white">{row.title}</p>
            <p className="mt-1 max-w-xs break-all text-xs text-[#71767B]">{row.manifestUrl}</p>
          </div>,
          courseTitles.get(row.courseId) || 'Archived course',
          attemptCount.get(row.id) || 0,
          <Badge key="a" tone={row.active ? 'green' : 'red'}>{row.active ? 'Active' : 'Disabled'}</Badge>,
          <a key="l" href={`/learn/scorm/${row.id}`} className="text-[#1D9BF0]">Launch</a>,
          <div key="manage" className="grid min-w-80 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/scorm" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={row.id} />
                <CourseSelect courses={courses} selected={row.courseId} />
                <input className="input" name="title" defaultValue={row.title} required />
                <input className="input" name="manifestUrl" defaultValue={row.manifestUrl} required />
                <input className="input" name="launchUrl" defaultValue={row.launchUrl} required />
                <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked={row.active} /> Active</label>
                <button className="btn-primary w-fit">Save</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/scorm" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="active" value={row.active ? 'false' : 'true'} />
                <button className="btn-secondary">{row.active ? 'Disable' : 'Activate'}</button>
              </form>
              <form action="/api/admin/scorm" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="action" value="delete" />
                <button className="btn-secondary">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
