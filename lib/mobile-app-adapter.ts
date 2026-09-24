import { prisma } from "@/lib/prisma";
import { fromJsonArray } from "@/lib/json-fields";
import { verifyAuthToken } from "@/lib/auth";

type DbCourse = Awaited<ReturnType<typeof findPublishedCourses>>[number];
type MobileDbUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  bio?: string | null;
  locale?: string | null;
};

function roleForMobile(role: string) {
  if (role === "INSTRUCTOR") return "teacher";
  if (role === "STUDENT") return "student";
  throw new Error(`Unsupported mobile role: ${role}`);
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function mobileStreakDays(userId: string) {
  const progressRows = await prisma.lessonProgress.findMany({
    where: {
      userId,
      OR: [{ completedAt: { not: null } }, { lastWatchedAt: { not: null } }],
    },
    select: { completedAt: true, lastWatchedAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 365,
  });
  const activeDays = new Set(
    progressRows.map((row) =>
      dayKey(row.completedAt ?? row.lastWatchedAt ?? row.updatedAt),
    ),
  );
  const today = new Date();
  let cursor = activeDays.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function mobileUser(user: MobileDbUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: roleForMobile(user.role),
    avatarUrl: user.avatar ?? null,
    bio: user.bio ?? null,
    locale: user.locale ?? null,
    streakDays: user.role === "STUDENT" ? await mobileStreakDays(user.id) : 0,
  };
}

function averageRating(course: { reviews: { rating: number }[] }) {
  if (!course.reviews.length) return 0;
  return Number(
    (
      course.reviews.reduce((sum, review) => sum + review.rating, 0) /
      course.reviews.length
    ).toFixed(1),
  );
}

function price(course: {
  isFree: boolean;
  salePrice: unknown;
  price: unknown;
}) {
  if (course.isFree) return 0;
  return Number(course.salePrice ?? course.price ?? 0);
}

function mobileLesson(
  lesson: DbCourse["modules"][number]["lessons"][number],
  completedLessonIds: ReadonlySet<string>,
) {
  return {
    id: lesson.id,
    title: lesson.title,
    durationMinutes: lesson.durationMinutes,
    completed: completedLessonIds.has(lesson.id),
  };
}

function mobileModule(
  module: DbCourse["modules"][number],
  completedLessonIds: ReadonlySet<string>,
) {
  return {
    id: module.id,
    title: module.title,
    lessons: module.lessons.map((lesson) =>
      mobileLesson(lesson, completedLessonIds),
    ),
  };
}

export function mobileCourse(
  course: DbCourse,
  featured = false,
  completedLessonIds: ReadonlySet<string> = new Set(),
) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    instructor: course.instructor.name,
    category: course.category?.nameEn ?? "Learning",
    level: course.level,
    imageUrl: course.coverImage ?? "",
    description: course.shortDescription || course.fullDescription,
    rating: averageRating(course),
    students: course._count.enrollments,
    durationMinutes: course.durationMinutes,
    price: price(course),
    outcomes: fromJsonArray<string>(course.outcomes),
    modules: course.modules.map((module) =>
      mobileModule(module, completedLessonIds),
    ),
    reviews: course.reviews.map((review) => ({
      id: review.id,
      name: review.user.name,
      rating: review.rating,
      body: review.comment ?? "",
      createdAt: review.createdAt.toISOString(),
    })),
    questions: course.questions.map((question) => ({
      id: question.id,
      name: question.user.name,
      title: question.title,
      body: question.body,
      answer: question.answer,
      helpfulCount: question.helpfulCount,
      createdAt: question.createdAt.toISOString(),
    })),
    featured,
  };
}

export async function completedLessonIdsForStudent(
  userId: string,
  courseIds: string[],
) {
  if (!courseIds.length) return new Set<string>();
  const rows = await prisma.lessonProgress.findMany({
    where: {
      userId,
      completed: true,
      lesson: { module: { courseId: { in: courseIds } } },
    },
    select: { lessonId: true },
  });
  return new Set(rows.map((row) => row.lessonId));
}

export async function findPublishedCourses() {
  return prisma.course.findMany({
    where: { status: "PUBLISHED" },
    include: {
      category: { select: { nameEn: true } },
      instructor: { select: { name: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
      questions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function firstMobileUser(role: "STUDENT" | "INSTRUCTOR") {
  return prisma.user.findFirst({
    where: { role, status: { not: "SUSPENDED" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });
}

async function mobileSessionFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyAuthToken(match[1]);
}

async function mobileUserForRequest(
  request: Request,
  role: "STUDENT" | "INSTRUCTOR",
) {
  const session = await mobileSessionFromRequest(request);
  if (!session || session.role !== role) return null;
  const userId = session.id;

  return prisma.user.findFirst({
    where: { id: userId, role, status: { not: "SUSPENDED" } },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });
}

export async function studentForRequest(request: Request) {
  return mobileUserForRequest(request, "STUDENT");
}

export async function instructorForRequest(request: Request) {
  return mobileUserForRequest(request, "INSTRUCTOR");
}

export async function mobileAccountForRequest(request: Request) {
  const session = await mobileSessionFromRequest(request);
  if (
    !session ||
    (session.role !== "STUDENT" && session.role !== "INSTRUCTOR")
  ) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: session.id,
      role: session.role,
      status: { not: "SUSPENDED" },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      bio: true,
      locale: true,
    },
  });
}
