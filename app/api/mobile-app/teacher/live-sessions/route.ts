import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
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

async function teacherSessionItems(
  instructorId: string,
  instructorName: string,
) {
  const sessions = await prisma.liveSession.findMany({
    where: { instructorId },
    orderBy: { startsAt: "asc" },
    take: 50,
    include: {
      course: { select: { title: true } },
    },
  });
  const sessionIds = sessions.map((session) => session.id);
  const attendanceCounts = sessionIds.length
    ? await prisma.liveSessionAttendance.groupBy({
        by: ["liveSessionId"],
        where: { liveSessionId: { in: sessionIds } },
        _count: { _all: true },
      })
    : [];
  const attendeesBySessionId = new Map(
    attendanceCounts.map((row) => [row.liveSessionId, row._count._all]),
  );

  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    description:
      session.description ||
      "Host a live classroom for guided learning and Q&A.",
    startsAt: formatStart(session.startsAt),
    durationMinutes: session.durationMinutes,
    provider: session.provider,
    joinUrl: session.url,
    courseTitle: session.course?.title || "Open live event",
    instructorName,
    attendees: attendeesBySessionId.get(session.id) || 0,
    isLive: isLiveNow(session.startsAt, session.durationMinutes),
  }));
}

export async function GET(request: NextRequest) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  return ok(await teacherSessionItems(instructor.id, instructor.name));
}

export async function POST(request: NextRequest) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const provider = String(body.provider || "External").trim();
  const url = String(body.joinUrl || body.url || "").trim();
  const courseId = String(body.courseId || "").trim() || null;
  const startsAt = new Date(String(body.startsAt || ""));
  const durationMinutes = Number(body.durationMinutes || 60);

  if (title.length < 3)
    return fail("Session title must be at least 3 characters.", 422);
  if (Number.isNaN(startsAt.getTime()))
    return fail("A valid start date is required.", 422);
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 600
  ) {
    return fail("Duration must be between 1 and 600 minutes.", 422);
  }
  if (!provider) return fail("Provider is required.", 422);
  if (!/^https?:\/\//i.test(url))
    return fail("A valid meeting URL is required.", 422);

  if (courseId) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, instructorId: instructor.id },
      select: { id: true },
    });
    if (!course) return fail("Course not found for this instructor.", 404);
  }

  await prisma.liveSession.create({
    data: {
      title,
      description,
      startsAt,
      durationMinutes: Math.round(durationMinutes),
      provider,
      url,
      courseId,
      instructorId: instructor.id,
    },
  });

  return ok(await teacherSessionItems(instructor.id, instructor.name));
}
