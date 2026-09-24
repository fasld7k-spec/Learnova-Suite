import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { emailTemplates, getEditableEmailTemplates } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

function excerpt(value: string | null | undefined, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export default async function ContentRewrite({ searchParams }: { searchParams?: { saved?: string; deleted?: string; cleared?: string; applied?: string } }) {
  await requireUser(['ADMIN']);
  const [rows, settings, courses, pages, posts, templates] = await Promise.all([
    prisma.contentRewriteRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    getSiteSettings(),
    prisma.course.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true } }),
    prisma.page.findMany({ orderBy: { slug: 'asc' }, select: { id: true, slug: true, titleEn: true } }),
    prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true } }),
    getEditableEmailTemplates(),
  ]);
  const isLiveAi = settings.aiEnabled && settings.aiProvider !== 'demo' && Boolean(settings.aiApiKey);
  const templateNames = new Map(emailTemplates.map((template) => [template.key, template.name]));
  const targetOptions = [
    ...courses.flatMap((course) => [
      { value: `course:${course.id}:title`, label: `Course: ${course.title} / Title` },
      { value: `course:${course.id}:shortDescription`, label: `Course: ${course.title} / Short description` },
      { value: `course:${course.id}:fullDescription`, label: `Course: ${course.title} / Full description` },
    ]),
    ...pages.flatMap((page) => [
      { value: `page:${page.id}:titleEn`, label: `Page: ${page.titleEn || page.slug} / English title` },
      { value: `page:${page.id}:bodyEn`, label: `Page: ${page.titleEn || page.slug} / English body` },
      { value: `page:${page.id}:titleAr`, label: `Page: ${page.titleEn || page.slug} / Arabic title` },
      { value: `page:${page.id}:bodyAr`, label: `Page: ${page.titleEn || page.slug} / Arabic body` },
      { value: `page:${page.id}:seoTitle`, label: `Page: ${page.titleEn || page.slug} / SEO title` },
      { value: `page:${page.id}:seoDescription`, label: `Page: ${page.titleEn || page.slug} / SEO description` },
    ]),
    ...posts.flatMap((post) => [
      { value: `blog:${post.id}:title`, label: `Blog: ${post.title} / Title` },
      { value: `blog:${post.id}:excerpt`, label: `Blog: ${post.title} / Excerpt` },
      { value: `blog:${post.id}:content`, label: `Blog: ${post.title} / Content` },
    ]),
    ...templates.flatMap((template) => [
      { value: `email:${template.key}:subject`, label: `Email: ${templateNames.get(template.key) || template.key} / Subject` },
      { value: `email:${template.key}:html`, label: `Email: ${templateNames.get(template.key) || template.key} / HTML body` },
    ]),
  ];

  return (
    <DashboardShell role="admin" title="Content Rewrite">
      {searchParams?.saved && <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">Content was rewritten and saved.</div>}
      {searchParams?.deleted && <div className="mb-4 rounded-2xl border border-[#2F3336] bg-[#16181C] p-4 text-sm font-bold text-[#E7E9EA]">Rewrite request deleted.</div>}
      {searchParams?.cleared && <div className="mb-4 rounded-2xl border border-[#2F3336] bg-[#16181C] p-4 text-sm font-bold text-[#E7E9EA]">Rewrite history cleared.</div>}
      {searchParams?.applied && <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">Rewritten copy applied to the selected target.</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form className="card grid gap-4" action="/api/admin/content-rewrite" method="post">
          <CsrfInput />
          <div>
            <h2 className="text-xl font-black text-white">Rewrite Platform Content</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Use this to polish course descriptions, landing copy, email text, policy snippets, or support replies. Live AI is controlled from admin settings; without a provider key, output is marked as demo/local fallback.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#E7E9EA]">
              Tone
              <select className="input mt-2" name="tone" defaultValue="professional">
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="marketing">Marketing</option>
                <option value="academic">Academic</option>
              </select>
            </label>
            <div className="rounded-2xl border border-[#2F3336] bg-black p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71767B]">Provider status</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={isLiveAi ? 'green' : 'yellow'}>{isLiveAi ? 'Live AI' : 'Demo/local fallback'}</Badge>
                <span className="text-sm text-[#71767B]">{settings.aiProvider}</span>
              </div>
            </div>
          </div>
          <label className="text-sm font-bold text-[#E7E9EA]">
            Optional target
            <select className="input mt-2" name="targetRef" defaultValue="">
              <option value="">Manual text only</option>
              {targetOptions.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
            </select>
            <span className="mt-2 block text-xs font-semibold leading-5 text-[#71767B]">
              Pick a target to rewrite its current text automatically, then apply the approved output back to the same field.
            </span>
          </label>
          <label className="text-sm font-bold text-[#E7E9EA]">
            Source content
            <textarea className="input mt-2 min-h-56" name="input" placeholder="Paste content, or leave empty when an optional target is selected." />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary">Rewrite Content</button>
            <a className="btn-secondary" href="/admin/settings#ai">Configure AI</a>
          </div>
        </form>

        <div className="card">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71767B]">History</p>
          <h3 className="mt-2 text-3xl font-black text-white">{rows.length}</h3>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Recent rewrite requests are stored so admins can reuse approved copy and audit AI-assisted changes.</p>
          {rows.length ? (
            <form className="mt-4" action="/api/admin/content-rewrite" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="clear" />
              <button className="btn-secondary w-full">Clear History</button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {rows.map((row) => (
          <article key={row.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.status === 'DONE' ? 'green' : row.status === 'FAILED' ? 'red' : 'yellow'}>{row.status}</Badge>
                  <span className="text-sm font-bold text-[#E7E9EA]">{row.tone}</span>
                  <span className="text-xs text-[#71767B]">{row.createdAt.toLocaleString()}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-[#71767B]">Input</p>
                <p className="mt-1 text-sm leading-6 text-[#E7E9EA]">{excerpt(row.input)}</p>
              </div>
              <form action="/api/admin/content-rewrite" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={row.id} />
                <button className="btn-secondary">Delete</button>
              </form>
            </div>
            <div className="mt-4 rounded-2xl border border-[#2F3336] bg-black p-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-white">{row.output || 'No output saved.'}</p>
            </div>
            {row.output ? (
              <form className="mt-4 grid gap-3 rounded-2xl border border-[#2F3336] bg-[#050608] p-4" action="/api/admin/content-rewrite" method="post">
                <CsrfInput />
                <input type="hidden" name="_action" value="apply" />
                <input type="hidden" name="id" value={row.id} />
                <label className="text-sm font-bold text-[#E7E9EA]">
                  Apply output to
                  <select className="input mt-2" name="targetRef" required>
                    <option value="">Choose target field</option>
                    {targetOptions.map((target) => <option key={`${row.id}-${target.value}`} value={target.value}>{target.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-[#E7E9EA]">
                  Editable output
                  <textarea className="input mt-2 min-h-32" name="output" defaultValue={row.output} required />
                </label>
                <button className="btn-primary w-fit">Apply rewritten copy</button>
              </form>
            ) : null}
          </article>
        ))}
        {!rows.length && <div className="card text-sm font-bold text-[#71767B]">No rewrite requests yet.</div>}
      </div>
    </DashboardShell>
  );
}
