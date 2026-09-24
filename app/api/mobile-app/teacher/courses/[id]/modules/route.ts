import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { fromJsonArray } from "@/lib/json-fields";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import {
  mobileRequestAppUrl,
  mobileTeacherLessonMedia,
} from "@/lib/mobile-media-urls";
import { prisma } from "@/lib/prisma";

function loadTeacherCourse(id: string, instructorId: string) {
  return prisma.course.findFirst({
    where: { id, instructorId },
    include: {
      category: { select: { nameEn: true } },
      reviews: { select: { rating: true } },
      modules: {
        orderBy: { sortOrder: "asc" },
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
      _count: { select: { enrollments: true } },
    },
  });
}

async function mobileTeacherCourse(
  course: NonNullable<Awaited<ReturnType<typeof loadTeacherCourse>>>,
  instructorName: string,
  instructorId: string,
  baseUrl: string,
) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    instructor: instructorName,
    category: course.category?.nameEn ?? "Learning",
    level: course.level,
    imageUrl: course.coverImage ?? "",
    description: course.shortDescription || course.fullDescription,
    rating: course.reviews.length
      ? Number(
          (
            course.reviews.reduce((sum, review) => sum + review.rating, 0) /
            course.reviews.length
          ).toFixed(1),
        )
      : 0,
    students: course._count.enrollments,
    durationMinutes: course.durationMinutes,
    price: Number(course.salePrice ?? course.price ?? 0),
    outcomes: fromJsonArray<string>(course.outcomes),
    featured: course.status === "PUBLISHED",
    status: course.status,
    modules: await Promise.all(
      course.modules.map(async (module) => ({
        id: module.id,
        title: module.title,
        lessons: await Promise.all(
          module.lessons.map(async (lesson) => ({
            id: lesson.id,
            title: lesson.title,
            durationMinutes: lesson.durationMinutes,
            completed: false,
            ...(await mobileTeacherLessonMedia({
              baseUrl,
              userId: instructorId,
              courseId: course.id,
              lessonId: lesson.id,
              videoUrl: lesson.videoUrl,
            })),
          })),
        ),
      })),
    ),
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const { id } = await context.params;
  const course = await loadTeacherCourse(id, instructor.id);
  if (!course) return fail("Course not found.", 404);
  if (course.status === "PUBLISHED") {
    return fail(
      "Published courses require review before curriculum changes.",
      422,
    );
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title || title.length < 3) return fail("Module title is required.", 422);

  const lastModule = await prisma.module.findFirst({
    where: { courseId: course.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.module.create({
    data: {
      courseId: course.id,
      title,
      sortOrder: (lastModule?.sortOrder ?? 0) + 1,
    },
  });

  const updated = await loadTeacherCourse(course.id, instructor.id);
  if (!updated) return fail("Course not found.", 404);
  return ok(
    await mobileTeacherCourse(
      updated,
      instructor.name,
      instructor.id,
      mobileRequestAppUrl(request),
    ),
    201,
  );
}
