import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const awards = await prisma.badgeAward.findMany({
    where: { userId: student.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok(
    awards.map((award) => ({
      id: award.id,
      title: award.title,
      description: award.reason,
      icon: award.icon ?? "spark",
      unlocked: true,
    })),
  );
}
