import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CertificateActions } from '@/components/certificates/CertificateActions';
import {
  certificateLookupCandidates,
  displayCertificateCode,
  getActiveCertificateTemplate,
  getCertificateAddon,
  renderCertificateTemplate,
} from '@/lib/certificates';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { Award, BadgeCheck, CalendarDays, Hash, Printer, ShieldCheck, UserRound } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';

export default async function CertificatePage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const certificateAddon = await getCertificateAddon();
  const codes = certificateLookupCandidates(decodeURIComponent(params.code), certificateAddon.prefix);
  const cert = await prisma.certificate.findFirst({ where: { code: { in: codes } }, include: { user: true } });
  if (!cert) notFound();
  const visibleCode = certificateAddon.active ? displayCertificateCode(cert.code, certificateAddon.prefix) : cert.code;
  const publicPath = `/certificates/${encodeURIComponent(cert.code)}`;
  const verifyPath = `/certificates/verify?code=${encodeURIComponent(cert.code)}`;
  const printPath = `/certificates/${encodeURIComponent(cert.code)}/print`;
  const [template, settings] = await Promise.all([getActiveCertificateTemplate(), getSiteSettings()]);
  let renderedTemplate: string | null = null;

  if (template) {
    try {
      renderedTemplate = renderCertificateTemplate(template.html, {
        student: cert.user.name,
        course: cert.courseTitle,
        instructor: cert.instructorName,
        issuedAt: cert.issuedAt.toLocaleDateString(),
        code: visibleCode,
        verifyUrl: verifyPath,
        printUrl: printPath,
        qrUrl: certificateAddon.active && certificateAddon.showQrCode ? `/api/certificates/qr/${encodeURIComponent(cert.code)}` : '',
        siteName: settings.siteName,
      });
    } catch {
      renderedTemplate = null;
    }
  }

  return (
    <>
      <Nav />
      <main className="moe-page py-10">
        <section className="moe-panel mx-auto max-w-5xl overflow-hidden">
          {renderedTemplate ? (
            <div className="border-b border-violet-300/15 bg-white p-4 md:p-8" dangerouslySetInnerHTML={{ __html: renderedTemplate }} />
          ) : (
            <>
              <div className="border-b border-violet-300/15 p-8 text-center md:p-12">
                <div className="moe-mini-icon mx-auto h-16 w-16">
                  <Award size={30} />
                </div>
                <p className="mt-8 text-xs font-black uppercase tracking-[0.14em] text-violet-200">Certificate of Completion</p>
                <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">{cert.user.name}</h1>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">has successfully completed</p>
                <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black text-violet-200 md:text-4xl">{cert.courseTitle}</h2>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
                <div className="rounded-md border border-violet-300/15 bg-white/[0.03] p-4">
                  <UserRound className="text-violet-200" size={20} />
                  <p className="mt-4 text-xs font-bold uppercase text-slate-400">Instructor</p>
                  <p className="mt-1 font-black text-white">{cert.instructorName}</p>
                </div>
                <div className="rounded-md border border-violet-300/15 bg-white/[0.03] p-4">
                  <CalendarDays className="text-violet-200" size={20} />
                  <p className="mt-4 text-xs font-bold uppercase text-slate-400">Issued</p>
                  <p className="mt-1 font-black text-white">{cert.issuedAt.toLocaleDateString()}</p>
                </div>
                <div className="rounded-md border border-violet-300/15 bg-white/[0.03] p-4">
                  <Hash className="text-violet-200" size={20} />
                  <p className="mt-4 text-xs font-bold uppercase text-slate-400">Verification Code</p>
                  <p className="mt-1 break-all font-mono text-sm font-black text-white">{visibleCode}</p>
                </div>
              </div>

              {certificateAddon.active && certificateAddon.showQrCode ? (
                <div className="border-t border-violet-300/15 p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-5 rounded-md border border-violet-300/15 bg-white p-4 text-black">
                    <Image
                      alt="Certificate verification QR code"
                      className="h-28 w-28"
                      height={112}
                      src={`/api/certificates/qr/${encodeURIComponent(cert.code)}`}
                      width={112}
                    />
                    <div>
                      <p className="text-sm font-black uppercase text-black">Scan to verify</p>
                      <p className="mt-2 max-w-md text-sm leading-6 text-[#555]">
                        This QR code is generated by the active Advanced Certificates add-on and opens the public verification page.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <div className="border-t border-violet-300/15 p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-emerald-300/25 bg-emerald-400/10 p-4 text-emerald-200">
              <span className="inline-flex items-center gap-2 font-bold">
                <BadgeCheck size={20} />
                Verified credential
              </span>
              <CertificateActions title={cert.courseTitle} publicPath={publicPath} verifyPath={verifyPath} printPath={printPath} />
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
              <a className="flex items-center gap-2 rounded-md border border-violet-300/15 bg-white/[0.03] p-3 hover:bg-white/[0.06]" href={verifyPath}>
                <ShieldCheck size={16} />
                Public verification link
              </a>
              <a className="flex items-center gap-2 rounded-md border border-violet-300/15 bg-white/[0.03] p-3 hover:bg-white/[0.06]" href={printPath}>
                <Printer size={16} />
                Printable PDF page
              </a>
              <a className="flex items-center gap-2 rounded-md border border-violet-300/15 bg-white/[0.03] p-3 hover:bg-white/[0.06]" href="/certificates/verify">
                <BadgeCheck size={16} />
                Verify another code
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
