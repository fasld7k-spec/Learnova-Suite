import { fail, ok } from "@/lib/api";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function money(value: unknown) {
  return Number(value || 0);
}

function deltaPercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function GET(request: Request) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - 30);
  const previousStart = new Date(now);
  previousStart.setDate(previousStart.getDate() - 60);

  const courses = await prisma.course.findMany({
    where: { instructorId: instructor.id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      enrollments: {
        select: { id: true, progress: true, createdAt: true },
      },
    },
  });
  const courseIds = courses.map((course) => course.id);
  const orderItems = courseIds.length
    ? await prisma.orderItem.findMany({
        where: { courseId: { in: courseIds }, order: { status: "PAID" } },
        select: {
          instructorEarning: true,
          order: { select: { createdAt: true } },
        },
      })
    : [];

  const revenue = orderItems.reduce(
    (sum, item) => sum + money(item.instructorEarning),
    0,
  );
  const enrollments = courses.flatMap((course) => course.enrollments);
  const completion = enrollments.length
    ? enrollments.reduce((sum, row) => sum + row.progress, 0) /
      enrollments.length
    : 0;
  const currentRevenue = orderItems
    .filter((item) => item.order.createdAt >= currentStart)
    .reduce((sum, item) => sum + money(item.instructorEarning), 0);
  const previousRevenue = orderItems
    .filter(
      (item) =>
        item.order.createdAt >= previousStart &&
        item.order.createdAt < currentStart,
    )
    .reduce((sum, item) => sum + money(item.instructorEarning), 0);
  const currentStudents = enrollments.filter(
    (enrollment) => enrollment.createdAt >= currentStart,
  ).length;
  const previousStudents = enrollments.filter(
    (enrollment) =>
      enrollment.createdAt >= previousStart &&
      enrollment.createdAt < currentStart,
  ).length;
  const currentCourses = courses.filter(
    (course) => course.createdAt >= currentStart,
  ).length;
  const previousCourses = courses.filter(
    (course) =>
      course.createdAt >= previousStart && course.createdAt < currentStart,
  ).length;
  const currentCompletionRows = enrollments.filter(
    (enrollment) => enrollment.createdAt >= currentStart,
  );
  const previousCompletionRows = enrollments.filter(
    (enrollment) =>
      enrollment.createdAt >= previousStart &&
      enrollment.createdAt < currentStart,
  );
  const currentCompletion = currentCompletionRows.length
    ? currentCompletionRows.reduce((sum, row) => sum + row.progress, 0) /
      currentCompletionRows.length
    : 0;
  const previousCompletion = previousCompletionRows.length
    ? previousCompletionRows.reduce((sum, row) => sum + row.progress, 0) /
      previousCompletionRows.length
    : 0;

  return ok([
    {
      label: "Revenue",
      value: revenue,
      delta: deltaPercent(currentRevenue, previousRevenue),
    },
    {
      label: "Students",
      value: enrollments.length,
      delta: deltaPercent(currentStudents, previousStudents),
    },
    {
      label: "Completion",
      value: Number(completion.toFixed(1)),
      delta: deltaPercent(currentCompletion, previousCompletion),
    },
    {
      label: "Courses",
      value: courses.length,
      delta: deltaPercent(currentCourses, previousCourses),
    },
  ]);
}
