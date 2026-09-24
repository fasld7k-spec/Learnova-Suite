import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

function entityFallback(job: { entity: string; entityId: string }) {
  return `${job.entity} content`;
}

export default async function TranslationJobs(props: { searchParams?: Promise<{ error?: string; retried?: string; deleted?: string; applied?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const rows = await prisma.translationJob.findMany({ orderBy: { createdAt: 'desc' } });
  const courseIds = rows.filter((job) => job.entity === 'course').map((job) => job.entityId);
  const pageIds = rows.filter((job) => job.entity === 'page').map((job) => job.entityId);
  const blogIds = rows.filter((job) => job.entity === 'blog').map((job) => job.entityId);

  const [courses, pages, posts] = await Promise.all([
    courseIds.length ? prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    pageIds.length ? prisma.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, titleEn: true } }) : Promise.resolve([]),
    blogIds.length ? prisma.blogPost.findMany({ where: { id: { in: blogIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
  ]);

  const labelMap = new Map<string, string>([
    ...courses.map((course) => [`course:${course.id}`, course.title] as const),
    ...pages.map((page) => [`page:${page.id}`, page.titleEn] as const),
    ...posts.map((post) => [`blog:${post.id}`, post.title] as const),
  ]);

  return (
    <DashboardShell role="admin" title="Translation Jobs">
      {searchParams?.error && (
        <div className="mb-6 border border-[#F4212E] bg-black p-4 text-sm font-bold text-[#F4212E]">
          {searchParams.error}
        </div>
      )}
      {searchParams?.retried && <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Translation job retried.</div>}
      {searchParams?.deleted && <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Translation job deleted.</div>}
      {searchParams?.applied && <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">Reviewed translation applied.</div>}
      <form className="card mb-6 grid gap-3 md:grid-cols-5" action="/api/admin/translation-jobs" method="post">
        <CsrfInput />
        <select className="input" name="entity" defaultValue="course">
          <option value="course">Course</option>
          <option value="page">Page</option>
          <option value="blog">Blog post</option>
        </select>
        <input className="input md:col-span-2" name="entityId" placeholder="Slug or ID" />
        <input className="input" name="locale" placeholder="ar, fr, es..." />
        <button className="btn-primary">Create Job</button>
      </form>
      <DataTable
        headers={['Content', 'Type', 'Locale', 'Status', 'Result', 'Date', 'Manage']}
        rows={rows.map((job) => {
          const result = fromJsonObject<any>(job.result);
          return [
          labelMap.get(`${job.entity}:${job.entityId}`) || entityFallback(job),
          job.entity,
          job.locale,
          <Badge key="s" tone={job.status === 'DONE' ? 'green' : job.status === 'FAILED' ? 'red' : job.status === 'NEEDS_REVIEW' ? 'blue' : 'yellow'}>{job.status}</Badge>,
          <details key="result" className="max-w-sm">
            <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">
              {result.error || (result.needsReview ? 'Fallback draft saved for manual review' : result.provider ? `Provider: ${result.provider}` : '-')}
            </summary>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap border border-[#2F3336] bg-[#050608] p-3 text-xs leading-5 text-[#E7E9EA]">
              {Object.keys(result).length ? JSON.stringify(result, null, 2) : 'No result payload yet.'}
            </pre>
          </details>,
          job.createdAt.toLocaleString(),
          <div key="manage" className="flex flex-wrap gap-2">
            {job.status === 'NEEDS_REVIEW' && (
              <form className="grid min-w-80 gap-2" action="/api/admin/translation-jobs" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="apply" />
                <input type="hidden" name="id" value={job.id} />
                {(job.entity === 'course' || job.entity === 'page' || job.entity === 'blog') && (
                  <input className="input" name="title" defaultValue={result.title || ''} placeholder="Reviewed title" required />
                )}
                {job.entity === 'course' && (
                  <>
                    <textarea className="input min-h-24" name="shortDescription" defaultValue={result.shortDescription || ''} placeholder="Reviewed short description" required />
                    <textarea className="input min-h-32" name="fullDescription" defaultValue={result.fullDescription || ''} placeholder="Reviewed full description" required />
                  </>
                )}
                {job.entity === 'page' && (
                  <textarea className="input min-h-32" name="body" defaultValue={result.body || ''} placeholder="Reviewed page body" required />
                )}
                {job.entity === 'blog' && (
                  <>
                    <textarea className="input min-h-24" name="excerpt" defaultValue={result.excerpt || ''} placeholder="Reviewed excerpt" required />
                    <textarea className="input min-h-32" name="content" defaultValue={result.content || ''} placeholder="Reviewed content" required />
                  </>
                )}
                <button className="btn-primary w-fit">Apply reviewed draft</button>
              </form>
            )}
            {job.status !== 'PROCESSING' && (
              <form action="/api/admin/translation-jobs" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="retry" />
                <input type="hidden" name="id" value={job.id} />
                <button className="btn-secondary">Retry</button>
              </form>
            )}
            <form action="/api/admin/translation-jobs" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="id" value={job.id} />
              <button className="btn-secondary">Delete</button>
            </form>
          </div>,
        ];
        })}
      />
    </DashboardShell>
  );
}
