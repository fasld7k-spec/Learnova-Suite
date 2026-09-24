import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { saveCourseCover } from "@/lib/course-upload";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import {
  mobileRequestAppUrl,
  mobileTeacherLessonMedia,
} from "@/lib/mobile-media-urls";
import { fromJsonArray } from "@/lib/json-fields";
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
  course: Awaited<ReturnType<typeof teacherCourses>>[number],
  instructorName: string,
  instructorId: string,
  baseUrl: string,
) {
  return {
    id: course.id,
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

function teacherCourses(instructorId: string) {
  return prisma.course.findMany({
    where: { instructorId },
    include: {
      category: { select: { nameEn: true } },
      reviews: { select: { rating: true } },
      modules: {
        orderBy: { sortOrder: "asc" },
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
      _count: { select: { enrollments: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

function parseFormTextValue(key: string, value: string): unknown {
  if (key === "includeCertificate" || key === "enableCohortDiscussion") {
    return value === "true" ? true : value === "false" ? false : value;
  }
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
  if (typeof value !== "string") return null;
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

export async function GET(request: NextRequest) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const courses = await teacherCourses(instructor.id);
  const baseUrl = mobileRequestAppUrl(request);
  return ok(
    await Promise.all(
      courses.map((course) =>
        mobileTeacherCourse(course, instructor.name, instructor.id, baseUrl),
      ),
    ),
  );
}

export async function POST(request: NextRequest) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const { body, coverFile } = await readCoursePayload(request);
  const title = String(body.title || "").trim();
  const categoryName = String(body.category || "General").trim();
  const level = String(body.level || "Beginner").trim();
  const price = Number(body.price || 0);
  const moduleTitle = String(body.moduleTitle || "Draft curriculum").trim();
  const lessonTitle = String(body.lessonTitle || "First lesson").trim();
  const includeCertificate = body.includeCertificate !== false;
  const enableCohortDiscussion = body.enableCohortDiscussion !== false;
  const outcomes = Array.isArray(body.outcomes)
    ? body.outcomes.map(String).filter(Boolean)
    : [];

  if (!title || !outcomes.length || !moduleTitle || !lessonTitle) {
    return fail(
      "Title, outcomes, module title and first lesson title are required.",
      422,
    );
  }

  const uploadedCover = await uploadedCoverUrl(coverFile);
  if (uploadedCover instanceof Response) return uploadedCover;
  let coverImage: string | null = null;
  try {
    coverImage =
      uploadedCover ?? optionalCoverUrl(body.coverImage ?? body.imageUrl);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Course cover image is invalid.",
      422,
    );
  }

  const categorySlug = slugify(categoryName) || "general";
  const category = await prisma.category.upsert({
    where: { slug: categorySlug },
    update: {},
    create: {
      slug: categorySlug,
      nameEn: categoryName,
      nameAr: categoryName,
    },
  });

  const baseSlug = slugify(title) || `course-${Date.now()}`;
  const course = await prisma.course.create({
    data: {
      title,
      slug: `${baseSlug}-${Date.now()}`,
      shortDescription: `${title} draft created from the mobile app.`,
      fullDescription: `${title} draft created from the mobile app.`,
      coverImage,
      level,
      price,
      outcomes: JSON.stringify(outcomes),
      targetAudience: JSON.stringify([]),
      requirements: JSON.stringify([]),
      status: "PENDING",
      includesCertificate: includeCertificate,
      instructorId: instructor.id,
      categoryId: category.id,
      modules: {
        create: {
          title: moduleTitle,
          sortOrder: 1,
          lessons: {
            create: {
              title: lessonTitle,
              sortOrder: 1,
              durationMinutes: 0,
            },
          },
        },
      },
    },
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

  if (enableCohortDiscussion) {
    await prisma.discussionTopic.create({
      data: {
        courseId: course.id,
        userId: instructor.id,
        title: `${course.title} cohort discussion`,
        body: "Use this discussion space for learner questions, weekly wins, and course updates.",
        pinned: true,
      },
    });
  }

  const baseUrl = mobileRequestAppUrl(request);
  return ok(
    await mobileTeacherCourse(course, instructor.name, instructor.id, baseUrl),
    201,
  );
}
