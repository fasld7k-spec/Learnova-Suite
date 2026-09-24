import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { getCertificateAddon } from '@/lib/certificates';
import { Award, SearchCheck, ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function VerifyCertificate(props: { searchParams: Promise<{ code?: string }> }) {
  const searchParams = await props.searchParams;
  const certificateAddon = await getCertificateAddon();
  const code = searchParams.code?.trim().toUpperCase();
  if (code) redirect(`/certificates/${encodeURIComponent(code)}`);

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft mx-auto grid max-w-5xl overflow-hidden lg:grid-cols-[1fr_420px]">
          <div className="p-6 sm:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <Award aria-hidden="true" size={26} />
            </span>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-violet-300">Certificate verification</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight text-white">Verify a Learnova Suite credential.</h1>
            <p className="mt-4 max-w-2xl leading-7 text-slate-300">
              Check whether a learner certificate was issued by the platform and open its public credential record.
            </p>
            <div className="moe-panel mt-8 flex items-start gap-3 p-4 text-sm font-semibold leading-6 text-slate-100">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-violet-300" size={20} />
              Verification uses the live certificate registry, so expired or mistyped codes will not resolve to a credential.
            </div>
          </div>

          <form className="moe-panel m-4 flex flex-col justify-center p-5 sm:m-6 sm:p-6" method="get" action="/certificates/verify">
            <div>
              <label className="text-sm font-bold text-white" htmlFor="code">
                Certificate code
              </label>
              <p className="mt-2 text-sm leading-6 text-slate-400" id="certificate-code-help">
                Use the code shown on the credential, including the {certificateAddon.prefix} prefix when present.
              </p>
            </div>
            <div className="relative mt-4">
              <SearchCheck aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                aria-describedby="certificate-code-help"
                autoCapitalize="characters"
                className="input pl-11 font-mono uppercase"
                id="code"
                name="code"
                placeholder={`${certificateAddon.prefix}-XXXX`}
                required
              />
            </div>
            <button className="moe-primary mt-5 w-full justify-center px-5 py-3" type="submit">Verify credential</button>
          </form>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
