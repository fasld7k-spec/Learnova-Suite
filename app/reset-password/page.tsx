import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { KeyRound, LockKeyhole } from 'lucide-react';

export default async function ResetPassword(props: { searchParams?: Promise<{ token?: string; status?: string }> }) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token || '';
  const status = searchParams?.status;
  const message = status === 'invalid-token'
    ? 'This reset link is invalid or expired. Request a new link.'
    : status === 'invalid-password'
      ? 'Enter matching passwords with at least 8 characters.'
      : '';

  return (
    <>
      <Nav />
      <main className="moe-page grid min-h-[calc(100vh-180px)] items-center py-12">
        <section className="page-shell w-full">
        <div className="moe-panel-soft mx-auto w-full max-w-2xl p-6 sm:p-10">
          <div className="moe-mini-icon h-14 w-14">
            <KeyRound size={24} />
          </div>
          <h1 className="mt-6 text-3xl font-black text-white">Reset password</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Choose a new password for this account. Reset links expire in 30 minutes and stop working after the password changes.</p>
          {message && <p className="mt-4 border border-red-900 bg-red-950/40 p-3 text-sm font-semibold text-red-200">{message}</p>}
          {!token && <p className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm font-semibold text-amber-200">No reset token found. Start from the forgot password page.</p>}

          <form className="mt-8 grid gap-3" action="/api/auth/reset-password" method="post">
            <CsrfInput />
            <input type="hidden" name="token" value={token} />
            <label className="relative block">
              <LockKeyhole size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" name="password" type="password" placeholder="New password" minLength={8} required disabled={!token} />
            </label>
            <label className="relative block">
              <LockKeyhole size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" name="confirmPassword" type="password" placeholder="Confirm new password" minLength={8} required disabled={!token} />
            </label>
            <button className="moe-primary mt-2 w-full justify-center px-5 py-3" disabled={!token}>Update password</button>
          </form>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
