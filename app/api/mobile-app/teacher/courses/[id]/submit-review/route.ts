import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { invalidateCourseCatalogCache } from "@/lib/cache";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function hasGeneratedDraftLessonContent(content: string | null) {
  return /replace this generated draft lesson/i.test(content || "");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const { id } = await context.params;
  const course = await prisma.course.findFirst({
    where: { id, instructorId: instructor.id },
    include: {
      modules: {
        include: {
          lessons: { select: { id: true, title: true, content: true } },
        },
      },
    },
  });

  if (!course) return fail("Course not found.", 404);
  if (course.status === "PUBLISHED") {
    return fail(
      "Published courses must be changed by an admin review action.",
      422,
    );
  }

  const lessonCount = course.modules.reduce(
    (sum, courseModule) => sum + courseModule.lessons.length,
    0,
  );
  if (
    !course.title.trim() ||
    !course.shortDescription.trim() ||
    !course.fullDescription.trim()
  ) {
    return fail(
      "Complete course title and descriptions before submitting.",
      422,
    );
  }
  if (!String(course.coverImage || "").trim()) {
    return fail(
      "Upload or paste a course cover before submitting for review.",
      422,
    );
  }
  if (course.modules.length === 0 || lessonCount === 0) {
    return fail(
      "Add at least one module and lesson before submitting for review.",
      422,
    );
  }

  const draftLesson = course.modules
    .flatMap((courseModule) => courseModule.lessons)
    .find((lesson) => hasGeneratedDraftLessonContent(lesson.content));
  if (draftLesson) {
    return fail(
      `Replace the generated draft content in lesson "${draftLesson.title}" before submitting for review.`,
      422,
    );
  }

  await prisma.course.update({
    where: { id: course.id },
    data: { status: "PENDING" },
  });
  await invalidateCourseCatalogCache();

  return ok({ id: course.id, status: "PENDING" });
}
