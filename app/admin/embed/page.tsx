import { CheckCircle2, Code2, Settings2 } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { getEmbedSettings } from '@/lib/embed-settings';
import { prisma } from '@/lib/prisma';
import { currentAppUrl } from '@/lib/request-url';
import { CsrfInput } from '@/components/CsrfInput';

export default async function EmbedTools(props: { searchParams?: Promise<{ saved?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const [courses, appUrl, settings] = await Promise.all([
    prisma.course.findMany({ where: { status: 'PUBLISHED' }, take: 20 }),
    currentAppUrl(),
    getEmbedSettings(),
  ]);

  return (
    <DashboardShell role="admin" title="Embed Widgets">
      {searchParams?.saved && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          Embed settings saved.
        </div>
      )}

      <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_380px]">
        <form className="card" action="/api/admin/embed" method="post">
          <CsrfInput />
          <div className="flex items-start gap-3">
            <Settings2 className="mt-1 shrink-0 text-[#1D9BF0]" size={22} />
            <div>
              <h2 className="text-xl font-black text-white">Embed settings</h2>
              <p className="mt-2 text-sm leading-6 text-[#71767B]">
                Control the generated iframe size, visual theme, partner note, and the domain policy buyers should mirror in deployment settings.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-[#E7E9EA]">
              Width
              <input className="input" name="width" type="number" min="240" max="1200" defaultValue={settings.width} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#E7E9EA]">
              Height
              <input className="input" name="height" type="number" min="260" max="1200" defaultValue={settings.height} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#E7E9EA]">
              Theme
              <select className="input" name="theme" defaultValue={settings.theme}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="brand">Brand</option>
              </select>
            </label>
          </div>
          <input className="input mt-3" name="ctaLabel" defaultValue={settings.ctaLabel} placeholder="CTA label" />
          <input className="input mt-3" name="allowedDomains" defaultValue={settings.allowedDomains} placeholder="*, https://partner.com, https://*.example.com" />
          <textarea className="input mt-3 min-h-24" name="partnerNote" defaultValue={settings.partnerNote} placeholder="Partner note" />
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> Enable public embeds
          </label>
          <button className="btn-primary mt-4 w-fit">Save Embed Settings</button>
        </form>

        <aside className="card">
          <Code2 className="text-[#1D9BF0]" size={22} />
          <h2 className="mt-3 text-xl font-black text-white">Runtime status</h2>
          <div className="mt-4 grid gap-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3"><span>Embeds</span><Badge tone={settings.enabled ? 'green' : 'red'}>{settings.enabled ? 'Enabled' : 'Disabled'}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span>Default size</span><Badge tone="blue">{settings.width}x{settings.height}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span>Theme</span><Badge tone="slate">{settings.theme}</Badge></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#71767B]">
            Proxy headers now allow `/embed/*` to be framed. For production domain restrictions, set `EMBED_FRAME_ANCESTORS` to match the allowed domains listed here.
          </p>
        </aside>
      </section>

      {courses.length ? (
        <div className="grid gap-4">
          {courses.map((course) => (
            <div className="card" key={course.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-black text-white">{course.title}</h2>
                <a className="btn-secondary" href={`/embed/course/${course.slug}`} target="_blank">Preview</a>
              </div>
              <p className="mt-2 text-sm text-[#71767B]">Paste this iframe into partner pages, blogs, or landing pages.</p>
              <code className="mt-3 block overflow-auto border border-[#2F3336] bg-[#16181C] p-3 text-xs text-white">
                {`<iframe src="${appUrl}/embed/course/${course.slug}" width="${settings.width}" height="${settings.height}" loading="lazy" title="${course.title.replace(/"/g, '&quot;')}"></iframe>`}
              </code>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center">
          <h2 className="text-xl font-black text-white">No published courses yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#71767B]">
            Publish at least one course from the Courses manager to generate embeddable marketplace widgets.
          </p>
          <a className="btn-primary mt-4 w-fit" href="/admin/courses">
            Open courses
          </a>
        </div>
      )}

      {settings.enabled && (
        <div className="mt-6 flex items-start gap-3 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm text-[#D7FBE8]">
          <CheckCircle2 className="mt-0.5 shrink-0 text-[#5EE4B3]" size={18} />
          <span>{settings.partnerNote}</span>
        </div>
      )}
    </DashboardShell>
  );
}
