import Link from 'next/link';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';

const oauthErrorMessages: Record<string, { en: string; ar: string }> = {
  account_exists: {
    en: 'An account with this email already exists. Sign in with your password first.',
    ar: 'يوجد حساب بهذا البريد بالفعل. سجّل الدخول بكلمة المرور أولاً.',
  },
  two_factor_required: {
    en: 'This account uses two-factor authentication. Sign in with your password and authenticator code.',
    ar: 'هذا الحساب يستخدم التحقق بخطوتين. سجّل الدخول بكلمة المرور ورمز التطبيق.',
  },
};

export default async function Login(props: { searchParams?: Promise<{ oauth?: string; status?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).auth;
  const oauthProviders = [
    settings.googleClientId ? { href: '/api/auth/oauth/google', label: 'Google' } : null,
    settings.githubClientId ? { href: '/api/auth/oauth/github', label: 'GitHub' } : null,
    settings.facebookClientId ? { href: '/api/auth/oauth/facebook', label: 'Facebook' } : null,
  ].filter((provider): provider is { href: string; label: string } => Boolean(provider));
  const oauthNotice = searchParams?.status === 'demo-config-required'
    ? `${searchParams.oauth || 'OAuth'} ${copy.oauthDemo}`
    : '';
  const oauthError = searchParams?.error
    ? oauthErrorMessages[searchParams.error] ?? { en: 'Sign-in with this provider failed. Please try again.', ar: 'تعذّر تسجيل الدخول بهذا المزوّد. حاول مرة أخرى.' }
    : null;
  const errorNotice = oauthError ? (settings.defaultLanguage === 'ar' ? oauthError.ar : oauthError.en) : '';
  const statusNotice = searchParams?.status === 'password-reset'
    ? copy.passwordUpdated
    : searchParams?.status === 'signed-out'
      ? copy.signedOut
      : '';

  return (
    <>
      <Nav />
      <main className="moe-page">
        <div className="page-shell grid min-h-[calc(100vh-5rem)] items-center py-12">
        <div className="moe-panel mx-auto grid w-full max-w-5xl overflow-hidden rounded-xl lg:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden border-r border-violet-300/20 p-8 text-white lg:block">
            <div className="moe-panel-soft flex h-full flex-col justify-between rounded-xl p-6">
              <div>
                <span className="moe-mini-icon mb-6">
                  <LockKeyhole size={21} />
                </span>
                <p className="text-xs font-black uppercase text-violet-200">{copy.welcomeBack}</p>
                <h1 className="moe-gradient-text mt-4 text-4xl font-black leading-tight">{copy.loginHero}</h1>
              </div>
              <div className="grid gap-3 text-sm">
                {copy.loginBullets.map((item) => (
                  <div key={item} className="moe-panel-soft rounded-lg p-3 font-semibold text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <form className="p-6 sm:p-10" action="/api/auth/login" method="post">
            <CsrfInput />
            <h2 className="text-3xl font-black text-white">{copy.loginTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{copy.loginSubtitle}</p>
            {oauthNotice && <p className="mt-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">{oauthNotice}</p>}
            {errorNotice && <p className="mt-4 rounded-lg border border-rose-300/40 bg-rose-400/10 p-3 text-sm font-semibold text-rose-100">{errorNotice}</p>}
            {statusNotice && <p className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-100">{statusNotice}</p>}
            <label className="relative mt-8 block">
              <Mail size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-200" />
              <input className="moe-control h-12 w-full px-5 pl-10 text-sm font-semibold" name="email" type="email" placeholder={copy.email} />
            </label>
            <label className="relative mt-3 block">
              <LockKeyhole size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-200" />
              <input className="moe-control h-12 w-full px-5 pl-10 text-sm font-semibold" name="password" type="password" placeholder={copy.password} />
            </label>
            <button className="moe-primary mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-black transition">
              {copy.loginTitle}
              <ArrowRight size={17} />
            </button>
            {oauthProviders.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {oauthProviders.map((provider) => (
                  <a key={provider.href} className="moe-control inline-flex h-11 items-center justify-center text-sm font-black text-white transition hover:bg-white/10" href={provider.href}>
                    {provider.label}
                  </a>
                ))}
              </div>
            )}
            <div className="mt-5 flex items-center justify-between gap-4 text-sm font-semibold">
              <Link className="text-violet-200 hover:text-white" href="/forgot-password">{copy.forgotPassword}</Link>
              <Link className="text-slate-300 hover:text-white" href="/register">{copy.createAccount}</Link>
            </div>
          </form>
        </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
