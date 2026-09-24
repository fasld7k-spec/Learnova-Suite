import { fail, ok } from "@/lib/api";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function formatLastActive(date: Date | null) {
  if (!date) return "No activity yet";
  const diffMs = Date.now() - date.getTime();
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function riskLabel(progress: number, lastActive: Date | null) {
  const inactiveDays = lastActive
    ? Math.floor((Date.now() - lastActive.getTime()) / 86_400_000)
    : 999;
  if (progress < 35 || inactiveDays >= 7) return "Needs attention";
  if (progress < 70 || inactiveDays >= 3) return "On track";
  return "Strong";
}

export async function GET(request: Request) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const enrollments = await prisma.enrollment.findMany({
    where: { course: { instructorId: instructor.id } },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      progress: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, avatar: true } },
      course: { select: { id: true, title: true } },
    },
  });

  const rows = await Promise.all(
    enrollments.map(async (enrollment) => {
      const activity = await prisma.lessonProgress.findFirst({
        where: {
          userId: enrollment.user.id,
          lesson: { module: { courseId: enrollment.course.id } },
        },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      });
      const lastActiveAt = activity?.updatedAt ?? enrollment.createdAt;
      const progress = Math.max(0, Math.min(100, enrollment.progress));
      return {
        id: enrollment.id,
        name: enrollment.user.name,
        email: enrollment.user.email,
        avatarUrl: enrollment.user.avatar ?? null,
        courseTitle: enrollment.course.title,
        progress: progress / 100,
        lastActive: formatLastActive(lastActiveAt),
        risk: riskLabel(progress, lastActiveAt),
      };
    }),
  );

  return ok(rows);
}
