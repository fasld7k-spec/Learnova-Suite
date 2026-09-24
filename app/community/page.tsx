import { EmptyState } from '@/components/EmptyState';
import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { localizedPageCopy } from '@/lib/page-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { MessageCircle, Pin, Plus, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Community() {
  await requireUser();
  const [topics, settings] = await Promise.all([
    prisma.discussionTopic.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    getSiteSettings()
  ]);
  const copy = localizedPageCopy(settings.defaultLanguage).community;

  const pinnedCount = topics.filter((topic) => topic.pinned).length;

  return (
    <>
      <Nav />
      <main className="moe-page py-10">
        <section className="page-shell">
        <div className="moe-panel-soft overflow-hidden p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">{copy.eyebrow}</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black text-white md:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">
                {copy.subtitle}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="moe-panel p-4">
                <MessageCircle className="text-violet-300" size={22} />
                <p className="mt-4 text-3xl font-black">{topics.length}</p>
                <p className="text-sm font-semibold text-slate-400">{copy.topics}</p>
              </div>
              <div className="moe-panel p-4">
                <Pin className="text-amber-300" size={22} />
                <p className="mt-4 text-3xl font-black">{pinnedCount}</p>
                <p className="text-sm font-semibold text-slate-400">{copy.pinned}</p>
              </div>
            </div>
          </div>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form className="moe-panel h-fit grid gap-4 p-5" action="/api/community/topics" method="post">
            <CsrfInput />
            <div className="flex items-center gap-3">
              <div className="moe-mini-icon">
                <Plus size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black">{copy.startTopic}</h2>
                <p className="text-sm font-semibold text-slate-400">{copy.startTopicBody}</p>
              </div>
            </div>
            <input className="input" name="title" placeholder={copy.topicTitle} minLength={4} required />
            <textarea className="input min-h-36" name="body" placeholder={copy.topicBody} minLength={10} required />
            <button className="moe-primary w-fit px-5 py-3">{copy.createTopic}</button>
          </form>

          <div className="grid gap-4">
            {topics.length ? (
              topics.map((topic) => (
                <a className="moe-panel moe-card-shine block p-5 transition hover:-translate-y-0.5" href={`/community/${topic.id}`} key={topic.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {topic.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-200">
                            <Pin size={13} />
                            {copy.pinned}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-400">
                          {topic.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black text-white">{topic.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{topic.body}</p>
                    </div>
                    <div className="moe-mini-icon">
                      <MessageCircle size={20} />
                    </div>
                  </div>
                </a>
              ))
            ) : (
              <EmptyState
                title={copy.noDiscussions}
                description={copy.noDiscussionsBody}
                action={
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-violet-200">
                    <Sparkles size={16} />
                    {copy.topicWillAppear}
                  </span>
                }
              />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
