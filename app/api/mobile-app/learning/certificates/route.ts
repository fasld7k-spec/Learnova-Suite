import { fail, ok } from "@/lib/api";
import { resolveAppUrl } from "@/lib/app-url";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);
  const origin = resolveAppUrl({
    headers: request.headers,
    requestOrigin: new URL(request.url).origin,
  });

  const certificates = await prisma.certificate.findMany({
    where: { userId: student.id },
    orderBy: { issuedAt: "desc" },
    take: 20,
  });

  return ok(
    certificates.map((certificate) => {
      const encodedCode = encodeURIComponent(certificate.code);
      return {
        id: certificate.id,
        title: certificate.courseTitle,
        instructorName: certificate.instructorName,
        issuedAt: certificate.issuedAt.toISOString(),
        credentialId: certificate.code,
        publicUrl: `${origin}/certificates/${encodedCode}`,
        verifyUrl: `${origin}/certificates/verify?code=${encodedCode}`,
        printUrl: `${origin}/certificates/${encodedCode}/print`,
      };
    }),
  );
}
