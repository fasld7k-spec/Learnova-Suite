import { PrintCertificateButton } from '@/components/certificates/PrintCertificateButton';
import {
  certificateLookupCandidates,
  displayCertificateCode,
  getActiveCertificateTemplate,
  getCertificateAddon,
  renderCertificateTemplate,
} from '@/lib/certificates';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { Award, BadgeCheck, CalendarDays, Hash, UserRound } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';

export default async function PrintableCertificatePage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const certificateAddon = await getCertificateAddon();
  const codes = certificateLookupCandidates(decodeURIComponent(params.code), certificateAddon.prefix);
  const cert = await prisma.certificate.findFirst({ where: { code: { in: codes } }, include: { user: true } });
  if (!cert) notFound();
  const visibleCode = certificateAddon.active ? displayCertificateCode(cert.code, certificateAddon.prefix) : cert.code;
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
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; color: #111111 !important; }
          main { padding: 0 !important; }
        }
      `}</style>
      <main className="min-h-screen p-4 md:p-10" style={{ backgroundColor: '#ffffff', color: '#111111' }}>
        <div className="no-print mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <a className="btn-secondary" href={`/certificates/${encodeURIComponent(cert.code)}`}>
            Back to certificate
          </a>
          <PrintCertificateButton />
        </div>

        {renderedTemplate ? (
          <section
            className="mx-auto max-w-5xl"
            style={{ backgroundColor: '#ffffff' }}
            dangerouslySetInnerHTML={{ __html: renderedTemplate }}
          />
        ) : (
          <section className="mx-auto max-w-5xl border-4 border-[#111] p-8 text-center md:p-12" style={{ backgroundColor: '#ffffff' }}>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-[#111] text-[#111]">
              <Award size={40} />
            </div>
            <p className="mt-8 text-sm font-black uppercase text-[#1D9BF0]">Certificate of Completion</p>
            <h1 className="mt-6 text-4xl font-black md:text-6xl">{cert.user.name}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#555]">has successfully completed</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black text-[#1D9BF0] md:text-5xl">{cert.courseTitle}</h2>

            <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
              <div className="border border-[#111] p-4">
                <UserRound size={20} />
                <p className="mt-4 text-xs font-black uppercase text-[#555]">Instructor</p>
                <p className="mt-1 font-black">{cert.instructorName}</p>
              </div>
              <div className="border border-[#111] p-4">
                <CalendarDays size={20} />
                <p className="mt-4 text-xs font-black uppercase text-[#555]">Issued</p>
                <p className="mt-1 font-black">{cert.issuedAt.toLocaleDateString()}</p>
              </div>
              <div className="border border-[#111] p-4">
                <Hash size={20} />
                <p className="mt-4 text-xs font-black uppercase text-[#555]">Verification Code</p>
                <p className="mt-1 break-all font-mono text-sm font-black">{visibleCode}</p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-2 border border-[#111] p-4 font-black text-[#007a4d]">
              <BadgeCheck size={20} />
              Verified credential
              <span className="font-mono text-[#555]">/certificates/verify?code={cert.code}</span>
            </div>
            {certificateAddon.active && certificateAddon.showQrCode ? (
              <div className="mt-8 flex justify-center">
                <Image
                  alt="Certificate verification QR code"
                  className="h-32 w-32"
                  height={128}
                  src={`/api/certificates/qr/${encodeURIComponent(cert.code)}`}
                  width={128}
                />
              </div>
            ) : null}
          </section>
        )}
      </main>
    </>
  );
}
