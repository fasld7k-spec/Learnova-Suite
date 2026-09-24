import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fromJsonObject } from '@/lib/json-fields';

export default async function CourseImportExport(props: {
  searchParams?: Promise<{
    imported?: string;
    exported?: string;
    importRetried?: string;
    exportRetried?: string;
    importDeleted?: string;
    exportDeleted?: string;
    importPurged?: string;
    exportPurged?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const [courses, imports, exports] = await Promise.all([
    prisma.course.findMany({ orderBy: { title: 'asc' } }),
    prisma.courseImportJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.courseExportJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  return (
    <DashboardShell role="admin" title="Course Import / Export">
      {(searchParams?.imported || searchParams?.exported || searchParams?.importRetried || searchParams?.exportRetried || searchParams?.importDeleted || searchParams?.exportDeleted || searchParams?.importPurged || searchParams?.exportPurged) && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          Course transfer action completed.
          {searchParams?.importPurged ? ` ${searchParams.importPurged} old import job(s) removed.` : ''}
          {searchParams?.exportPurged ? ` ${searchParams.exportPurged} old export job(s) removed.` : ''}
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm font-bold text-[#71767B]">Import jobs</p>
          <p className="mt-2 text-2xl font-black text-white">{imports.length}</p>
          <p className="mt-1 text-xs text-[#71767B]">Latest 50 course import jobs.</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-[#71767B]">Export jobs</p>
          <p className="mt-2 text-2xl font-black text-white">{exports.length}</p>
          <p className="mt-1 text-xs text-[#71767B]">Latest 50 generated exports.</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-[#71767B]">Failed jobs</p>
          <p className="mt-2 text-2xl font-black text-white">{imports.filter((job) => job.status === 'FAILED').length + exports.filter((job) => job.status === 'FAILED').length}</p>
          <p className="mt-1 text-xs text-[#71767B]">Use retry after fixing file URLs or course data.</p>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form className="card grid gap-3" action="/api/admin/course-import" method="post" encType="multipart/form-data">
          <CsrfInput />
          <input type="hidden" name="_action" value="create" />
          <h2 className="text-xl font-bold">Import Course</h2>
          <select className="input" name="source">
            <option value="csv">CSV file</option>
            <option value="json">Developer JSON</option>
            <option value="backup">Platform backup</option>
          </select>
          <input className="input" name="title" placeholder="Import title" />
          <input className="input" name="fileUrl" placeholder="Import file URL or /uploads/import.json" />
          <label className="grid gap-2 text-sm font-bold text-[#E7E9EA]">
            Or upload import file
            <input className="input" type="file" name="file" accept=".csv,.json,application/json,text/csv,text/plain" />
          </label>
          <textarea className="input min-h-24" name="notes" placeholder="Import notes" />
          <button className="btn-primary">Create Import Job</button>
        </form>

        <form className="card grid gap-3" action="/api/admin/course-export" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="create" />
          <h2 className="text-xl font-bold">Export Course</h2>
          <select className="input" name="courseId" required>
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <select className="input" name="format">
            <option value="csv">CSV</option>
            <option value="backup">Backup</option>
            <option value="json">Developer JSON</option>
          </select>
          <button className="btn-primary">Create Export Job</button>
        </form>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Import Jobs</h2>
        <form className="flex flex-wrap items-center gap-2" action="/api/admin/course-import" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge_old" />
          <input className="input h-10 w-28" name="days" type="number" min="1" defaultValue="30" aria-label="Import purge days" />
          <button className="btn-secondary h-10">Purge old imports</button>
        </form>
      </div>
      <DataTable
        headers={['Source', 'Status', 'Result', 'Date', 'Manage']}
        rows={imports.map((job) => {
          const payload = fromJsonObject<any>(job.payload);
          return [
          job.source,
          <Badge key="s" tone={job.status === 'DONE' ? 'green' : job.status === 'FAILED' ? 'red' : 'yellow'}>{job.status}</Badge>,
          job.status === 'FAILED' ? payload.error || 'Failed' : payload.importedCount ? `${payload.importedCount} course(s)` : '-',
          job.createdAt.toLocaleString(),
          <div className="flex flex-wrap gap-2" key="actions">
            <form action="/api/admin/course-import" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="retry" />
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn-secondary h-9 px-3 text-xs">Retry</button>
            </form>
            <form action="/api/admin/course-import" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn-secondary h-9 border-red-400/40 px-3 text-xs text-red-200">Delete</button>
            </form>
          </div>,
        ];
        })}
      />

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Export Jobs</h2>
        <form className="flex flex-wrap items-center gap-2" action="/api/admin/course-export" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="purge_old" />
          <input className="input h-10 w-28" name="days" type="number" min="1" defaultValue="30" aria-label="Export purge days" />
          <button className="btn-secondary h-10">Purge old exports</button>
        </form>
      </div>
      <DataTable
        headers={['Course', 'Format', 'Status', 'File', 'Manage']}
        rows={exports.map((job) => [
          courseTitles.get(job.courseId) || 'Archived course',
          job.format,
          <Badge key="s" tone={job.status === 'DONE' ? 'green' : job.status === 'FAILED' ? 'red' : 'yellow'}>{job.status}</Badge>,
          job.fileUrl ? <a key="file" href={job.fileUrl} className="text-[#1D9BF0]">Download</a> : '-',
          <div className="flex flex-wrap gap-2" key="actions">
            <form action="/api/admin/course-export" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="retry" />
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn-secondary h-9 px-3 text-xs">Retry</button>
            </form>
            <form action="/api/admin/course-export" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="jobId" value={job.id} />
              <button className="btn-secondary h-9 border-red-400/40 px-3 text-xs text-red-200">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
