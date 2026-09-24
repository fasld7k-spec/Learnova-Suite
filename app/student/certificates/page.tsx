import { CertificateActions } from '@/components/certificates/CertificateActions';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Award, CalendarDays, Hash, ShieldCheck } from 'lucide-react';

export default async function Certificates() {
  const user = await requireUser(['STUDENT']);
  const certs = await prisma.certificate.findMany({
    where: { userId: user.id },
    orderBy: { issuedAt: 'desc' }
  });

  return (
    <DashboardShell role="student" title="Certificates">
      <div className="mb-6 border border-[#2F3336] bg-[#16181C] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Earned certificates</p>
            <h2 className="mt-2 text-2xl font-black text-white">{certs.length} verified credential{certs.length === 1 ? '' : 's'}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
              Share public certificate links, print PDF copies, or send the verification URL to anyone who needs to confirm completion.
            </p>
          </div>
          <a className="btn-secondary w-fit" href="/certificates/verify">
            <ShieldCheck size={16} />
            Public verifier
          </a>
        </div>
      </div>

      {certs.length ? (
        <div className="grid gap-4">
          {certs.map((certificate) => {
            const publicPath = `/certificates/${encodeURIComponent(certificate.code)}`;
            const verifyPath = `/certificates/verify?code=${encodeURIComponent(certificate.code)}`;
            const printPath = `/certificates/${encodeURIComponent(certificate.code)}/print`;

            return (
              <article className="card" key={certificate.id}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1D9BF0] text-white">
                        <Award size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase text-[#71767B]">Certificate of completion</p>
                        <h3 className="mt-1 truncate text-xl font-black text-white">{certificate.courseTitle}</h3>
                      </div>
                    </div>

                    <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
                      <div className="border border-[#2F3336] p-3">
                        <dt className="flex items-center gap-2 font-bold text-[#71767B]">
                          <CalendarDays size={15} />
                          Issued
                        </dt>
                        <dd className="mt-2 font-black text-white">{certificate.issuedAt.toLocaleDateString()}</dd>
                      </div>
                      <div className="border border-[#2F3336] p-3">
                        <dt className="font-bold text-[#71767B]">Instructor</dt>
                        <dd className="mt-2 font-black text-white">{certificate.instructorName}</dd>
                      </div>
                      <div className="border border-[#2F3336] p-3">
                        <dt className="flex items-center gap-2 font-bold text-[#71767B]">
                          <Hash size={15} />
                          Verification code
                        </dt>
                        <dd className="mt-2 break-all font-mono text-xs font-black text-white">{certificate.code}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 lg:items-end">
                    <a className="btn-primary" href={publicPath}>
                      View certificate
                    </a>
                    <CertificateActions title={certificate.courseTitle} publicPath={publicPath} verifyPath={verifyPath} printPath={printPath} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card text-center">
          <Award className="mx-auto text-[#71767B]" size={38} />
          <h3 className="mt-4 text-xl font-black text-white">No certificates earned yet</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#71767B]">
            Complete every lesson in a certificate-enabled course and your verified credential will appear here automatically.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}
