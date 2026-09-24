import { ArrowRight, Mail, MessageSquare, UserRound } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';

export default async function Contact(props: { searchParams?: Promise<{ status?: string; ticket?: string }> }) {
  const searchParams = await props.searchParams;
  const sent = searchParams?.status === 'sent';
  const invalid = searchParams?.status === 'invalid';
  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).contact;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <div className="page-shell grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="moe-panel-soft p-6 text-white md:p-8">
            <div className="flex h-full min-h-72 flex-col justify-between">
              <div>
                <h1 className="text-4xl font-black leading-tight">{copy.title}</h1>
                <p className="mt-4 text-base leading-7 text-slate-300">{copy.subtitle}</p>
              </div>
              <div className="mt-8 grid gap-3 text-sm">
                {copy.bullets.map((item) => (
                  <div key={item} className="rounded-md border border-violet-300/15 bg-white/[0.04] p-3 font-semibold text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <form className="moe-panel p-6 sm:p-8" action="/api/contact" method="post">
            <CsrfInput />
            <h2 className="text-3xl font-black text-white">{copy.sendMessage}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{copy.body}</p>
            {sent && (
              <div className="mt-6 rounded-md border border-emerald-300/40 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
                {copy.received} {searchParams?.ticket || copy.created}.
              </div>
            )}
            {invalid && (
              <div className="mt-6 rounded-md border border-rose-300/30 bg-rose-400/10 p-4 text-sm font-bold text-rose-200">
                {copy.invalid}
              </div>
            )}
            <label className="relative mt-8 block">
              <UserRound size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="moe-control w-full pl-10" name="name" placeholder={copy.name} />
            </label>
            <label className="relative mt-3 block">
              <Mail size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="moe-control w-full pl-10" name="email" type="email" placeholder={copy.email} />
            </label>
            <input className="moe-control mt-3 w-full" name="subject" placeholder={copy.subject} />
            <label className="relative mt-3 block">
              <MessageSquare size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
              <textarea className="moe-control min-h-40 w-full pl-10" name="message" placeholder={copy.message} />
            </label>
            <button className="moe-primary mt-5">
              {copy.button}
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
