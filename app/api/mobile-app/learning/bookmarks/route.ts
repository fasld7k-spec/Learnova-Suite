import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const bookmarks = await prisma.lessonBookmark.findMany({
    where: { userId: student.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (!bookmarks.length) return ok([]);

  const lessonIds = bookmarks.map((bookmark) => bookmark.lessonId);
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: lessonIds } },
    include: {
      module: {
        include: {
          course: { select: { id: true, title: true } },
        },
      },
    },
  });
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  return ok(
    bookmarks.map((bookmark) => {
      const lesson = lessonById.get(bookmark.lessonId);
      return {
        id: bookmark.id,
        lessonId: bookmark.lessonId,
        lessonTitle: lesson?.title ?? "Archived lesson",
        courseId: lesson?.module.course.id ?? "",
        courseTitle: lesson?.module.course.title ?? "Archived course",
        moduleTitle: lesson?.module.title ?? "Archived module",
        durationMinutes: lesson?.durationMinutes ?? 0,
        note: bookmark.note ?? null,
        createdAt: bookmark.createdAt.toISOString(),
      };
    }),
  );
}
