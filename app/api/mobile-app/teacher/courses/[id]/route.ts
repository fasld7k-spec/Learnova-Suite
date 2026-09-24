import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { saveCourseCover } from "@/lib/course-upload";
import { fromJsonArray } from "@/lib/json-fields";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import {
  mobileRequestAppUrl,
  mobileTeacherLessonMedia,
} from "@/lib/mobile-media-urls";
import { prisma } from "@/lib/prisma";
import { validateStoredUrl } from "@/lib/url-validation";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
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

function parseFormTextValue(key: string, value: string): unknown {
  if (key === "price") return Number(value);
  if (key === "outcomes") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function formFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return file instanceof File ? file : null;
}

async function readCoursePayload(request: NextRequest): Promise<{
  body: Record<string, unknown>;
  coverFile: File | null;
}> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return {
      body: (await request.json().catch(() => ({}))) as Record<string, unknown>,
      coverFile: null,
    };
  }

  const formData = await request.formData();
  const body: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const parsed = parseFormTextValue(key, value);
    if (key === "outcomes" && body.outcomes) {
      body.outcomes = Array.isArray(body.outcomes)
        ? [...body.outcomes, parsed]
        : [body.outcomes, parsed];
    } else {
      body[key] = parsed;
    }
  }
  return { body, coverFile: formFile(formData, "coverFile") };
}

function optionalCoverUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  return raw
    ? validateStoredUrl(raw, {
        label: "Course cover image",
        allowRelative: true,
      })
    : null;
}

async function uploadedCoverUrl(coverFile: File | null) {
  try {
    return coverFile ? await saveCourseCover(coverFile) : null;
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Course cover image is invalid.",
      422,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const { id } = await context.params;
  const existing = await loadTeacherCourse(id, instructor.id);
  if (!existing) return fail("Course not found.", 404);
  if (existing.status === "PUBLISHED") {
    return fail(
      "Published courses require a marketplace review action before editing.",
      422,
    );
  }

  const { body, coverFile } = await readCoursePayload(request);
  const title = String(body.title || "").trim();
  const categoryName = String(body.category || "").trim();
  const level = String(body.level || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price);
  const outcomes = Array.isArray(body.outcomes)
    ? body.outcomes
        .map(String)
        .map((item: string) => item.trim())
        .filter(Boolean)
    : [];

  if (!title || title.length < 3) return fail("Course title is required.", 422);
  if (!categoryName) return fail("Course category is required.", 422);
  if (!level) return fail("Course level is required.", 422);
  if (!description || description.length < 12) {
    return fail("Course description must be at least 12 characters.", 422);
  }
  if (!Number.isFinite(price) || price < 0)
    return fail("Course price is invalid.", 422);
  if (!outcomes.length)
    return fail("At least one learning outcome is required.", 422);

  const uploadedCover = await uploadedCoverUrl(coverFile);
  if (uploadedCover instanceof Response) return uploadedCover;
  let coverImage: string | null | undefined;
  try {
    const textCover = optionalCoverUrl(body.coverImage ?? body.imageUrl);
    coverImage = uploadedCover ?? textCover;
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Course cover image is invalid.",
      422,
    );
  }

  const categorySlug = slugify(categoryName) || "general";
  const category = await prisma.category.upsert({
    where: { slug: categorySlug },
    update: { nameEn: categoryName, nameAr: categoryName },
    create: {
      slug: categorySlug,
      nameEn: categoryName,
      nameAr: categoryName,
    },
  });

  await prisma.course.update({
    where: { id: existing.id },
    data: {
      title,
      shortDescription: description,
      fullDescription: description,
      categoryId: category.id,
      level,
      price,
      salePrice: null,
      outcomes: JSON.stringify(outcomes),
      ...(coverImage !== undefined ? { coverImage } : {}),
    },
  });

  const course = await loadTeacherCourse(existing.id, instructor.id);
  if (!course) return fail("Course not found.", 404);
  return ok(
    await mobileTeacherCourse(
      course,
      instructor.name,
      instructor.id,
      mobileRequestAppUrl(request),
    ),
  );
}
