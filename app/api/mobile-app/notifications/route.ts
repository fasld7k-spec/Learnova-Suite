import { fail, ok } from "@/lib/api";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const notifications = await prisma.notification.findMany({
    where: { userId: student.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return ok(
    notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: "update",
      time: notification.createdAt.toISOString(),
      read: notification.read,
    })),
  );
}

export async function POST(request: Request) {
  const student = await studentForRequest(request);
  if (!student) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "markAllRead") {
    await prisma.notification.updateMany({
      where: { userId: student.id, read: false },
      data: { read: true },
    });
    return ok({ updated: true });
  }

  if (action === "markRead") {
    const id = String(body.id || "");
    if (id) {
      await prisma.notification.updateMany({
        where: { id, userId: student.id },
        data: { read: true },
      });
    }
    return ok({ updated: true });
  }

  return ok({ updated: false });
}
