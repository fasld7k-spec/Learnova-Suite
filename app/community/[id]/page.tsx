import { EmptyState } from '@/components/EmptyState';
import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ArrowLeft, Lock, MessageSquare, Reply } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TopicPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireUser();
  const topic = await prisma.discussionTopic.findUnique({
    where: { id: params.id },
    include: { replies: { orderBy: { createdAt: 'asc' } } },
  });

  if (!topic) notFound();

  return (
    <>
      <Nav />
      <main className="moe-page py-10">
        <section className="page-shell">
        <a className="moe-control mb-5 inline-flex h-11 w-fit items-center gap-2 px-4 text-sm font-bold text-white" href="/community">
          <ArrowLeft size={17} />
          Back to community
        </a>

        <article className="moe-panel-soft p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-400">
            <span>{topic.createdAt.toLocaleDateString()}</span>
            {topic.locked && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-200">
                <Lock size={14} />
                Locked
              </span>
            )}
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-black text-white md:text-5xl">{topic.title}</h1>
          <p className="mt-5 max-w-3xl whitespace-pre-wrap leading-8 text-slate-200">{topic.body}</p>
        </article>
        </section>

        <section className="page-shell mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-white">Replies</h2>
              <span className="rounded-lg border border-violet-300/15 bg-white/5 px-3 py-1 text-sm font-bold text-slate-200">
                {topic.replies.length}
              </span>
            </div>

            {topic.replies.length ? (
              topic.replies.map((reply) => (
                <div className="moe-panel p-5" key={reply.id}>
                  <div className="flex items-start gap-3">
                    <div className="moe-mini-icon h-10 w-10 shrink-0">
                      <MessageSquare size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap leading-7 text-slate-200">{reply.body}</p>
                      <p className="mt-3 text-xs font-semibold text-slate-400">{reply.createdAt.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No replies yet" description="Be the first to add a useful answer or clarification." />
            )}
          </div>

          {topic.locked ? (
            <div className="moe-panel h-fit p-5">
              <Lock className="text-amber-300" size={24} />
              <h2 className="mt-4 text-xl font-black">Topic locked</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">This discussion is closed for new replies.</p>
            </div>
          ) : (
            <form className="moe-panel h-fit grid gap-4 p-5" action="/api/community/replies" method="post">
              <CsrfInput />
              <div className="flex items-center gap-3">
                <div className="moe-mini-icon">
                  <Reply size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black">Add a reply</h2>
                  <p className="text-sm text-slate-400">Keep it specific and helpful.</p>
                </div>
              </div>
              <input type="hidden" name="topicId" value={topic.id} />
              <textarea className="input min-h-40" name="body" placeholder="Write your reply" minLength={4} required />
              <button className="moe-primary w-fit px-5 py-3">Reply</button>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
