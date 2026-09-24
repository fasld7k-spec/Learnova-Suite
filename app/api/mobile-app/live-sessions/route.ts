import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function formatStart(date: Date) {
  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isLiveNow(startsAt: Date, durationMinutes: number) {
  const now = Date.now();
  const start = startsAt.getTime();
  const end = start + durationMinutes * 60_000;
  return now >= start && now <= end;
}

export async function GET(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: student.id },
    select: { courseId: true },
  });
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const now = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const sessions = await prisma.liveSession.findMany({
    where: {
      startsAt: { gte: now },
      OR: [
        { courseId: null },
        { isPreview: true },
        ...(courseIds.length ? [{ courseId: { in: courseIds } }] : []),
      ],
    },
    orderBy: { startsAt: "asc" },
    take: 20,
    include: {
      course: { select: { title: true } },
    },
  });

  const instructorIds = [
    ...new Set(sessions.map((session) => session.instructorId)),
  ];
  const sessionIds = sessions.map((session) => session.id);
  const instructors = instructorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: instructorIds } },
        select: { id: true, name: true },
      })
    : [];
  const attendanceCounts = sessionIds.length
    ? await prisma.liveSessionAttendance.groupBy({
        by: ["liveSessionId"],
        where: { liveSessionId: { in: sessionIds } },
        _count: { _all: true },
      })
    : [];
  const instructorNameById = new Map(
    instructors.map((user) => [user.id, user.name]),
  );
  const attendeesBySessionId = new Map(
    attendanceCounts.map((row) => [row.liveSessionId, row._count._all]),
  );

  return ok(
    sessions.map((session) => ({
      id: session.id,
      title: session.title,
      description:
        session.description ||
        "Join the live classroom for guided learning and Q&A.",
      startsAt: formatStart(session.startsAt),
      durationMinutes: session.durationMinutes,
      provider: session.provider,
      joinUrl: session.url,
      courseTitle: session.course?.title || "Open live event",
      instructorName:
        instructorNameById.get(session.instructorId) || "Instructor",
      attendees: attendeesBySessionId.get(session.id) || 0,
      isLive: isLiveNow(session.startsAt, session.durationMinutes),
    })),
  );
}
