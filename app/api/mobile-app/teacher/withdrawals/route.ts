import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { fromJsonObject } from "@/lib/json-fields";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function money(value: unknown) {
  return Number(value || 0);
}

function payoutMethodLabel(method: { method: string; details: string }) {
  const details = fromJsonObject<Record<string, string>>(method.details);
  return `${method.method}${details.accountName ? ` - ${details.accountName}` : ""}`;
}

export async function GET(request: NextRequest) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const courses = await prisma.course.findMany({
    where: { instructorId: instructor.id },
    select: { id: true },
  });
  const courseIds = courses.map((course) => course.id);
  const [items, withdrawals] = await Promise.all([
    courseIds.length
      ? prisma.orderItem.findMany({
          where: { courseId: { in: courseIds }, order: { status: "PAID" } },
          include: {
            order: { select: { invoiceNumber: true, createdAt: true } },
          },
          orderBy: { order: { createdAt: "desc" } },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.withdrawal.findMany({
      where: { instructorId: instructor.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalEarnings = items.reduce(
    (sum, item) => sum + money(item.instructorEarning),
    0,
  );
  const paidOut = withdrawals
    .filter(
      (withdrawal) =>
        withdrawal.status === "APPROVED" || withdrawal.status === "PAID",
    )
    .reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0);
  const pendingBalance = withdrawals
    .filter((withdrawal) => withdrawal.status === "PENDING")
    .reduce((sum, withdrawal) => sum + money(withdrawal.amount), 0);
  const availableBalance = Math.max(
    totalEarnings - paidOut - pendingBalance,
    0,
  );

  const earningTransactions = items.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title || item.order.invoiceNumber,
    amount: money(item.instructorEarning),
    date: item.order.createdAt.toISOString(),
    status: "PAID",
  }));
  const withdrawalTransactions = withdrawals.slice(0, 8).map((withdrawal) => ({
    id: withdrawal.id,
    title: `Withdrawal via ${withdrawal.method}`,
    amount: -money(withdrawal.amount),
    date: withdrawal.createdAt.toISOString(),
    status: withdrawal.status,
  }));

  return ok({
    availableBalance,
    pendingBalance,
    totalEarnings,
    transactions: [...withdrawalTransactions, ...earningTransactions]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 12),
  });
}

export async function POST(request: NextRequest) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const methodId = String(body.methodId || "").trim();
  const amount = Number(body.amount || 0);

  if (!methodId || !Number.isFinite(amount) || amount <= 0) {
    return fail("Saved payout method and amount are required.", 422);
  }

  const payoutMethod = await prisma.instructorPayoutMethod.findFirst({
    where: { id: methodId, instructorId: instructor.id, active: true },
  });
  if (!payoutMethod) {
    return fail(
      "Select an active payout method from your saved payout methods.",
      422,
    );
  }

  const summary = await GET(request);
  const payload = await summary.json();
  const availableBalance = Number(payload?.data?.availableBalance || 0);
  if (amount > availableBalance) {
    return fail("Withdrawal amount exceeds available balance.", 422);
  }

  const withdrawal = await prisma.withdrawal.create({
    data: {
      instructorId: instructor.id,
      method: payoutMethodLabel(payoutMethod),
      amount,
      status: "PENDING",
    },
  });

  return ok(
    {
      id: withdrawal.id,
      method: withdrawal.method,
      amount: Number(withdrawal.amount),
      status: withdrawal.status,
      createdAt: withdrawal.createdAt.toISOString(),
    },
    201,
  );
}
