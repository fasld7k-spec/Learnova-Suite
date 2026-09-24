import { ArrowRight, CheckCircle2, Clock3, LifeBuoy, Mail, MessageSquare, ShieldCheck, UserRound } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';

export default async function Support(props: { searchParams?: Promise<{ ticket?: string }> }) {
  const searchParams = await props.searchParams;
  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).support;
  const ticketId = String(searchParams?.ticket || '').trim();

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-violet-300/15 bg-white/[0.03] p-8 lg:border-b-0 lg:border-r">
            <span className="moe-mini-icon h-12 w-12">
              <LifeBuoy size={23} />
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl">{copy.title}</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              {copy.subtitle}
            </p>
            <div className="mt-8 grid gap-3 text-sm">
              {copy.promises.map((item) => (
                <div className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-3 font-semibold text-white" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form className="p-6 sm:p-10" action="/api/support" method="post">
            <CsrfInput />
            <h2 className="text-3xl font-black text-white">{copy.createTicket}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{copy.privateRequest}</p>
            {ticketId ? (
              <p className="mt-5 rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-100">
                Your ticket was created successfully. Reference: {ticketId}
              </p>
            ) : null}
            <label className="relative mt-8 block">
              <UserRound size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" name="name" placeholder={copy.name} required />
            </label>
            <label className="relative mt-3 block">
              <Mail size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" name="email" type="email" placeholder={copy.email} required />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select className="input" name="category" defaultValue="Account">
                <option>{copy.account}</option>
                <option>{copy.courseAccess}</option>
                <option>{copy.checkout}</option>
                <option>{copy.certificate}</option>
                <option>{copy.instructor}</option>
              </select>
              <select className="input" name="priority" defaultValue="Normal">
                <option>{copy.low}</option>
                <option>{copy.normal}</option>
                <option>{copy.high}</option>
                <option>{copy.urgent}</option>
              </select>
            </div>
            <input className="input mt-3" name="subject" placeholder={copy.subject} required />
            <label className="relative mt-3 block">
              <MessageSquare size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
              <textarea className="input min-h-40 pl-10" name="message" placeholder={copy.whatHappened} required />
            </label>
            <button className="moe-primary mt-5 px-5 py-3" type="submit">
              {copy.submitTicket}
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-4 lg:grid-cols-3">
          <div className="moe-panel moe-card-shine p-5">
            <Clock3 size={22} className="text-violet-300" />
            <h2 className="mt-4 text-xl font-black text-white">{copy.responseWorkflow}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{copy.responseWorkflowBody}</p>
          </div>
          <div className="moe-panel moe-card-shine p-5">
            <ShieldCheck size={22} className="text-[#5EE4B3]" />
            <h2 className="mt-4 text-xl font-black text-white">{copy.privateByDefault}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{copy.privateByDefaultBody}</p>
          </div>
          <div className="moe-panel moe-card-shine p-5">
            <CheckCircle2 size={22} className="text-violet-300" />
            <h2 className="mt-4 text-xl font-black text-white">{copy.usefulDetails}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{copy.usefulDetailsBody}</p>
          </div>
        </section>

        <section className="page-shell mt-8">
        <div className="moe-panel p-5 sm:p-6">
          <h2 className="text-2xl font-black text-white">{copy.commonTopics}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {copy.topics.map((topic) => (
              <article className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-4" key={topic.title}>
                <h3 className="font-black text-white">{topic.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{topic.body}</p>
              </article>
            ))}
          </div>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
