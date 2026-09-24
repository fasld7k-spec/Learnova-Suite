import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';
import { KeyRound, Mail } from 'lucide-react';

export default async function ForgotPassword(
  props: { searchParams?: Promise<{ status?: string; resetToken?: string; demoToken?: string }> }
) {
  const searchParams = await props.searchParams;
  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).auth;
  const sent = searchParams?.status === 'sent';
  const resetToken = searchParams?.resetToken || searchParams?.demoToken || '';
  const resetHref = resetToken ? `/reset-password?token=${encodeURIComponent(resetToken)}` : '';

  return (
    <>
      <Nav />
      <main className="moe-page grid min-h-[calc(100vh-180px)] items-center py-12">
        <section className="page-shell w-full">
        <div className="moe-panel-soft mx-auto grid w-full max-w-5xl overflow-hidden lg:grid-cols-[1fr_420px]">
          <div className="p-8 md:p-10">
            <div className="moe-mini-icon h-14 w-14">
              <KeyRound size={24} />
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-violet-300">{copy.accountRecovery}</p>
            <h1 className="mt-3 max-w-xl text-4xl font-black text-white">{copy.recoveryTitle}</h1>
            <p className="mt-4 max-w-lg leading-7 text-slate-300">
              {copy.recoveryBody}
            </p>
          </div>

          <form className="grid gap-4 border-t border-violet-300/15 bg-white/[0.03] p-8 md:p-10 lg:border-l lg:border-t-0" action="/api/auth/forgot-password" method="post">
            <CsrfInput />
            {sent && (
              <div className="border border-emerald-800 bg-emerald-950/40 p-3 text-sm font-semibold text-emerald-200">
                {copy.resetQueued}
                {resetHref && (
                  <a className="mt-2 block text-violet-200 underline" href={resetHref}>
                    {copy.openResetLink}
                  </a>
                )}
              </div>
            )}
            <label className="text-sm font-bold text-slate-200" htmlFor="email">
              {copy.emailAddress}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input className="input pl-10" id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <button className="moe-primary mt-2 w-full justify-center px-5 py-3">{copy.sendReset}</button>
            <p className="text-center text-sm text-slate-400">
              {copy.remembered}{' '}
              <a className="font-bold text-violet-200" href="/login">
                {copy.signIn}
              </a>
            </p>
          </form>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
