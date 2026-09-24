import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { emailVerifiedCookieName, requireUser } from '@/lib/auth';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';
import { BadgeCheck, GraduationCap, KeyRound, LogOut, ShieldCheck, UserRound } from 'lucide-react';

export default async function Account(
  props: { searchParams?: Promise<{ verification?: string; password?: string; registered?: string }> }
) {
  const searchParams = await props.searchParams;
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect('/login');
  }

  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).account;
  const roleCopy = {
    STUDENT: {
      title: copy.studentTitle,
      body: copy.studentBody,
      href: '/student',
      cta: copy.studentCta
    },
    INSTRUCTOR: {
      title: copy.instructorTitle,
      body: copy.instructorBody,
      href: '/instructor',
      cta: copy.instructorCta
    },
    ADMIN: {
      title: copy.adminTitle,
      body: copy.adminBody,
      href: '/admin',
      cta: copy.adminCta
    }
  };
  const role = (user.role in roleCopy ? user.role : 'STUDENT') as keyof typeof roleCopy;
  const roleInfo = roleCopy[role];
  const verifiedEmail = (await cookies()).get(emailVerifiedCookieName)?.value;
  const emailVerified = verifiedEmail === user.email;
  const verificationMessage = searchParams?.verification === 'verified'
    ? copy.verified
    : searchParams?.verification === 'sent'
      ? copy.sent
      : searchParams?.verification === 'invalid'
        ? copy.invalid
        : searchParams?.registered
          ? copy.registered
          : '';
  const passwordMessage = searchParams?.password === 'changed'
    ? copy.passwordChanged
    : searchParams?.password === 'invalid'
      ? copy.passwordInvalid
      : '';

  return (
    <>
      <Nav />
      <main className="moe-page py-10">
        <section className="page-shell grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="moe-panel-soft p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-violet-300">{copy.eyebrow}</p>
                <h1 className="mt-2 text-3xl font-black text-white">{user.name}</h1>
                <p className="mt-2 text-sm text-slate-400">{user.email}</p>
              </div>
              <span className="rounded-lg border border-violet-300/15 bg-white/[0.04] px-3 py-2 text-sm font-black text-white">{role}</span>
            </div>
            {(verificationMessage || passwordMessage) && (
              <div className="mt-6 grid gap-3">
                {verificationMessage && <p className="rounded-lg border border-violet-300/15 bg-white/[0.04] p-3 text-sm font-semibold text-violet-200">{verificationMessage}</p>}
                {passwordMessage && <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-200">{passwordMessage}</p>}
              </div>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="moe-panel p-5">
                <div className="flex items-center gap-3 text-white">
                  <BadgeCheck size={20} className={emailVerified ? 'text-emerald-300' : 'text-[#FFD400]'} />
                  <h2 className="font-black">{copy.emailVerification}</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#B0B6BB]">
                  {emailVerified ? copy.verifiedBody : copy.pendingBody}
                </p>
                {!emailVerified && (
                  <form className="mt-4" action="/api/account" method="post">
                    <input type="hidden" name="action" value="send-verification" />
                    <CsrfInput />
                    <button className="moe-control inline-flex h-11 w-full items-center justify-center text-sm font-bold text-white">{copy.resend}</button>
                  </form>
                )}
              </div>

              <div className="moe-panel p-5">
                <div className="flex items-center gap-3 text-white">
                  <ShieldCheck size={20} className="text-violet-300" />
                  <h2 className="font-black">{copy.session}</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#B0B6BB]">{copy.sessionBody}</p>
                <form className="mt-4" action="/api/auth/logout" method="post">
                  <CsrfInput />
                  <button className="moe-control inline-flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-white">
                    <LogOut size={17} />
                    {copy.signOutDevice}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <aside className="moe-panel h-fit p-6">
            <div className="flex items-center gap-3 text-white">
              {role === 'STUDENT' ? <GraduationCap size={22} /> : role === 'ADMIN' ? <ShieldCheck size={22} /> : <UserRound size={22} />}
              <h2 className="font-black">{roleInfo.title}</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#B0B6BB]">{roleInfo.body}</p>
            <a className="moe-primary mt-5 w-full justify-center px-5 py-3" href={roleInfo.href}>{roleInfo.cta}</a>
            {role === 'INSTRUCTOR' && user.status !== 'APPROVED' && (
              <p className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm font-semibold text-amber-200">{copy.instructorStatus}: {user.status}. {copy.approvalNote}</p>
            )}
          </aside>
        </section>

        <section className="page-shell mt-6">
        <div className="moe-panel p-6 sm:p-8">
          <div className="flex items-center gap-3 text-white">
            <KeyRound size={21} className="text-violet-300" />
            <h2 className="text-xl font-black">{copy.changePassword}</h2>
          </div>
          <form className="mt-5 grid gap-3 md:grid-cols-3" action="/api/account" method="post">
            <input type="hidden" name="action" value="change-password" />
            <CsrfInput />
            <input className="input" name="currentPassword" type="password" placeholder={copy.currentPassword} minLength={8} required />
            <input className="input" name="password" type="password" placeholder={copy.newPassword} minLength={8} required />
            <input className="input" name="confirmPassword" type="password" placeholder={copy.confirmPassword} minLength={8} required />
            <button className="moe-primary justify-center px-5 py-3 md:col-span-3">{copy.updatePassword}</button>
          </form>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
