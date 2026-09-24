import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const { id } = await params;
  const session = await prisma.liveSession.findUnique({
    where: { id },
    select: {
      id: true,
      url: true,
      courseId: true,
      isPreview: true,
    },
  });
  if (!session) return fail("Live session not found.", 404);

  if (session.courseId && !session.isPreview) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: student.id,
          courseId: session.courseId,
        },
      },
      select: { id: true },
    });
    if (!enrollment)
      return fail("Course enrollment is required for this live session.", 403);
  }

  const attendance = await prisma.liveSessionAttendance.upsert({
    where: {
      liveSessionId_userId: {
        liveSessionId: session.id,
        userId: student.id,
      },
    },
    update: {},
    create: {
      liveSessionId: session.id,
      userId: student.id,
    },
  });

  return ok({
    sessionId: session.id,
    joinUrl: session.url,
    joinedAt: attendance.joinedAt.toISOString(),
  });
}
