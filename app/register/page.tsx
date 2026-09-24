import Link from 'next/link';
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';

export default async function Register() {
  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).auth;
  if (!settings.registrationEnabled) {
    return (
      <>
      <Nav />
      <main className="moe-page">
        <div className="page-shell grid min-h-[calc(100vh-5rem)] items-center py-12">
        <div className="moe-panel mx-auto w-full max-w-2xl rounded-xl p-6 text-center sm:p-10">
          <span className="moe-mini-icon mx-auto mb-6">
            <LockKeyhole size={21} />
          </span>
          <h1 className="text-3xl font-black text-white">{copy.registrationClosed}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{copy.registrationClosedBody}</p>
            <Link className="moe-primary mt-6 inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-black transition" href="/login">{copy.loginTitle}</Link>
          </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="moe-page">
        <div className="page-shell grid min-h-[calc(100vh-5rem)] items-center py-12">
        <div className="moe-panel mx-auto grid w-full max-w-5xl overflow-hidden rounded-xl lg:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden border-r border-violet-300/20 p-8 lg:block">
            <div className="moe-panel-soft flex h-full flex-col justify-between rounded-xl p-6">
              <div>
                <span className="moe-mini-icon mb-6">
                  <UserRound size={21} />
                </span>
                <p className="text-xs font-black uppercase text-violet-200">{copy.createAccount}</p>
                <h2 className="moe-gradient-text mt-4 text-4xl font-black leading-tight">{copy.registerTitle}</h2>
              </div>
              <div className="grid gap-3">
                <div className="moe-progress"><span style={{ width: '78%' }} /></div>
                <p className="text-sm font-semibold leading-6 text-slate-300">{copy.registerNote}</p>
              </div>
            </div>
          </section>

          <div className="p-6 sm:p-10">
          <h1 className="text-3xl font-black text-white">{copy.registerTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{copy.registerSubtitle}</p>
          <p className="mt-4 rounded-lg border border-violet-300/30 bg-violet-400/10 p-3 text-sm font-semibold text-violet-100">
            {copy.registerNote}
          </p>
          <form className="mt-8" action="/api/auth/register" method="post">
            <CsrfInput />
            <label className="relative block">
              <UserRound size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-200" />
              <input className="moe-control h-12 w-full px-5 pl-10 text-sm font-semibold" name="name" placeholder={copy.name} />
            </label>
            <label className="relative mt-3 block">
              <Mail size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-200" />
              <input className="moe-control h-12 w-full px-5 pl-10 text-sm font-semibold" name="email" type="email" placeholder={copy.email} />
            </label>
            <label className="relative mt-3 block">
              <LockKeyhole size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-200" />
              <input className="moe-control h-12 w-full px-5 pl-10 text-sm font-semibold" name="password" type="password" placeholder={copy.passwordMin} />
            </label>
            <select className="moe-control mt-3 h-12 w-full px-5 text-sm font-semibold" name="role">
              <option value="STUDENT">{copy.student}</option>
              {settings.instructorsEnabled && <option value="INSTRUCTOR">{copy.instructor}</option>}
            </select>
            <button className="moe-primary mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-black transition">
              {copy.registerButton}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-400">
            {copy.alreadyAccount} <Link href="/login" className="font-bold text-violet-200 hover:text-white">{copy.loginTitle}</Link>
          </p>
        </div>
        </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
