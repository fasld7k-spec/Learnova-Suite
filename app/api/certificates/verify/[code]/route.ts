import { fail, ok } from '@/lib/api';
import { certificateLookupCandidates, getCertificateAddon } from '@/lib/certificates';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: codeParam } = await params;
  const certificateAddon = await getCertificateAddon();
  const codes = certificateLookupCandidates(decodeURIComponent(codeParam), certificateAddon.prefix);
  const cert = await prisma.certificate.findFirst({ where: { code: { in: codes } }, include: { user: true } });
  if (!cert) return fail('Invalid certificate', 404);

  const origin = new URL(req.url).origin;
  return ok({
    code: cert.code,
    student: cert.user.name,
    course: cert.courseTitle,
    instructor: cert.instructorName,
    issuedAt: cert.issuedAt,
    publicUrl: `${origin}/certificates/${encodeURIComponent(cert.code)}`,
    verificationUrl: `${origin}/certificates/verify?code=${encodeURIComponent(cert.code)}`,
    printableUrl: `${origin}/certificates/${encodeURIComponent(cert.code)}/print`
  });
}
