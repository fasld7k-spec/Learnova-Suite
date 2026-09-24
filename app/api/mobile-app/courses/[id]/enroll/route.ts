import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { appUrlFromRequest } from "@/lib/app-url";
import {
  findPublishedCourses,
  studentForRequest,
} from "@/lib/mobile-app-adapter";
import { createGatewaySession } from "@/lib/payment-gateways";
import { createOrderForCourse } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

async function checkoutOptionsFromRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return {};

  const value = body as Record<string, unknown>;
  return {
    gateway: String(value.gateway || "manual").trim() || "manual",
    couponCode: String(value.couponCode || "").trim() || undefined,
    taxCountry:
      String(value.taxCountry || "")
        .trim()
        .toUpperCase() || undefined,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const { id } = await params;
  const courses = await findPublishedCourses();
  const course = courses.find((item) => item.id === id || item.slug === id);
  if (!course) return fail("Course not found", 404);

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
  });
  const coursePrice = course.isFree
    ? 0
    : Number(course.salePrice ?? course.price ?? 0);
  if (!existingEnrollment && coursePrice > 0) {
    const paidOrderItem = await prisma.orderItem.findFirst({
      where: {
        courseId: course.id,
        order: { userId: student.id, status: "PAID" },
      },
      select: { id: true },
    });
    if (!paidOrderItem) {
      const checkoutOptions = await checkoutOptionsFromRequest(request);
      const pendingOrder = await prisma.order.findFirst({
        where: {
          userId: student.id,
          status: "PENDING",
          items: { some: { courseId: course.id } },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, gateway: true },
      });
      const order =
        pendingOrder ??
        (await createOrderForCourse({
          userId: student.id,
          courseId: course.id,
          gateway: checkoutOptions.gateway,
          couponCode: checkoutOptions.couponCode,
          taxCountry: checkoutOptions.taxCountry,
        }));
      const session = await createGatewaySession(
        order.id,
        order.gateway,
        appUrlFromRequest(request),
      );

      return fail(
        "Checkout is required before enrolling in this paid course.",
        402,
        {
          checkoutUrl: session.redirectUrl,
          webCheckoutUrl: session.redirectUrl,
          checkoutMode: session.mode,
          gateway: session.gateway,
          orderId: order.id,
          courseId: course.id,
          courseTitle: course.title,
        },
      );
    }
  }

  const enrollment =
    existingEnrollment ??
    (await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        progress: 0,
      },
    }));

  const totalLessons = course.modules.reduce(
    (sum, module) => sum + module.lessons.length,
    0,
  );

  return ok({
    courseId: enrollment.courseId,
    courseTitle: course.title,
    percent: enrollment.progress / 100,
    completedLessons: Math.round((enrollment.progress / 100) * totalLessons),
    totalLessons,
  });
}
