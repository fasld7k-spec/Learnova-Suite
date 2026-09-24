import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

type Outline = {
  title?: string;
  modules?: { title: string; lessons: string[] }[];
  outcomes?: string[];
};

export default async function AIIdeas() {
  const user = await requireUser(['INSTRUCTOR']);
  const [rows, settings] = await Promise.all([
    prisma.aICourseIdea.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    getSiteSettings(),
  ]);
  const liveAiReady = settings.aiEnabled && settings.aiProvider !== 'demo' && Boolean(settings.aiApiKey);

  return (
    <DashboardShell role="instructor" title="AI Course Ideas">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form className="card grid gap-3" action="/api/instructor/ai-course-ideas" method="post">
          <CsrfInput />
          <div>
            <h2 className="text-xl font-black text-white">Generate a course outline</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Describe the topic, audience, level, and project goal. When a live provider is configured, this uses the saved AI provider. Otherwise outputs are clearly marked as local fallback drafts.
            </p>
          </div>
          <textarea className="input min-h-28" name="prompt" placeholder="Describe the course you want to create" required />
          <button className="btn-primary w-fit">Generate Outline</button>
        </form>

        <aside className="card h-fit">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71767B]">Provider status</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={liveAiReady ? 'green' : 'yellow'}>{liveAiReady ? 'Live AI' : 'Local fallback'}</Badge>
            <span className="text-sm font-semibold text-[#E7E9EA]">{settings.aiProvider}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#71767B]">
            AI keys are managed by the administrator from Settings. Local fallback is safe for demos and must be reviewed before publishing.
          </p>
        </aside>
      </div>

      <div className="mt-6 grid gap-4">
        {rows.map((row) => {
          const outline = fromJsonObject<Outline>(row.outline);
          const fallbackDraft = String(outline.title || '').toLowerCase().includes('fallback') || outline.outcomes?.some((item) => item.toLowerCase().includes('fallback'));
          return (
            <article className="card" key={row.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-[#71767B]">{row.prompt}</p>
                {fallbackDraft ? <Badge tone="yellow">Review before publishing</Badge> : <Badge tone="green">Provider generated</Badge>}
              </div>
              <h2 className="mt-2 text-2xl font-black">{outline.title || 'Course outline'}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {(outline.modules || []).map((module) => (
                  <div className="border border-[#2F3336] p-4" key={module.title}>
                    <b className="text-white">{module.title}</b>
                    <ul className="mt-3 grid gap-2 text-sm text-[#71767B]">
                      {module.lessons.map((lesson) => (
                        <li key={lesson}>{lesson}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {outline.outcomes?.length ? (
                <p className="mt-4 text-sm leading-6 text-[#71767B]">{outline.outcomes.join(' / ')}</p>
              ) : null}
              <form className="mt-5 border-t border-[#2F3336] pt-4" action="/api/instructor/ai-course-ideas" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="create-course" />
                <input type="hidden" name="ideaId" value={row.id} />
                <button className="btn-primary w-fit">Create course draft</button>
              </form>
            </article>
          );
        })}
      </div>
    </DashboardShell>
  );
}
