import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { fromJsonObject, toJson } from "@/lib/json-fields";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function maskPayoutMethod(method: string, details: Record<string, string>) {
  if (method === "Bank Transfer") {
    const account = String(details.accountNumber || "").replace(/\s+/g, "");
    const suffix = account.slice(-4);
    return [details.bankName, suffix ? `**** ${suffix}` : ""]
      .filter(Boolean)
      .join(" - ");
  }
  if (method === "PayPal" || method === "Wise") {
    return details.email || details.accountName || method;
  }
  return details.accountName || method;
}

function cleanDetails(body: Record<string, unknown>) {
  const nested =
    body.details && typeof body.details === "object" && !Array.isArray(body.details)
      ? (body.details as Record<string, unknown>)
      : {};

  return {
    accountName: String(body.accountName ?? nested.accountName ?? "").trim(),
    email: String(body.email ?? nested.email ?? "").trim(),
    bankName: String(body.bankName ?? nested.bankName ?? "").trim(),
    accountNumber: String(body.accountNumber ?? nested.accountNumber ?? "").trim(),
  };
}

function validateMethod(method: string, details: Record<string, string>) {
  if (!["PayPal", "Bank Transfer", "Wise"].includes(method)) {
    return "Unsupported payout method.";
  }
  if (!details.accountName) return "Account holder name is required.";
  if (
    (method === "PayPal" || method === "Wise") &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)
  ) {
    return "A valid payout email is required.";
  }
  if (method === "Bank Transfer" && (!details.bankName || !details.accountNumber)) {
    return "Bank name and account/IBAN are required.";
  }
  return "";
}

function serializePayoutMethod(method: {
  id: string;
  method: string;
  details: string;
  active: boolean;
}) {
  const details = fromJsonObject<Record<string, string>>(method.details);
  return {
    id: method.id,
    method: method.method,
    label: `${method.method}${details.accountName ? ` - ${details.accountName}` : ""}`,
    detailsLabel: maskPayoutMethod(method.method, details),
    active: method.active,
  };
}

export async function GET(request: Request) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const methods = await prisma.instructorPayoutMethod.findMany({
    where: { instructorId: instructor.id, active: true },
    orderBy: { createdAt: "desc" },
  });

  return ok(
    methods.map((method) => serializePayoutMethod(method)),
  );
}

export async function POST(request: NextRequest) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body._action || body.action || "create").trim();
  const id = String(body.id || "").trim();

  if (action === "delete") {
    if (!id) return fail("Payout method ID is required.", 422);
    const deleted = await prisma.instructorPayoutMethod.deleteMany({
      where: { id, instructorId: instructor.id },
    });
    if (!deleted.count) return fail("Payout method not found.", 404);
    return ok({ id, deleted: true });
  }

  if (action === "set-default") {
    if (!id) return fail("Payout method ID is required.", 422);
    const method = await prisma.instructorPayoutMethod.findFirst({
      where: { id, instructorId: instructor.id },
    });
    if (!method) return fail("Payout method not found.", 404);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.instructorPayoutMethod.updateMany({
        where: { instructorId: instructor.id },
        data: { active: false },
      });
      return tx.instructorPayoutMethod.update({
        where: { id },
        data: { active: true },
      });
    });

    return ok(serializePayoutMethod(updated));
  }

  const method = String(body.method || "PayPal").trim();
  const details = cleanDetails(body);
  const validationError = validateMethod(method, details);
  if (validationError) return fail(validationError, 422);

  if (action === "update") {
    if (!id) return fail("Payout method ID is required.", 422);
    const existing = await prisma.instructorPayoutMethod.findFirst({
      where: { id, instructorId: instructor.id },
    });
    if (!existing) return fail("Payout method not found.", 404);

    const updated = await prisma.instructorPayoutMethod.update({
      where: { id },
      data: { method, details: toJson(details) },
    });

    return ok(serializePayoutMethod(updated));
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.instructorPayoutMethod.updateMany({
      where: { instructorId: instructor.id },
      data: { active: false },
    });

    return tx.instructorPayoutMethod.create({
      data: {
        instructorId: instructor.id,
        method,
        details: toJson(details),
        active: true,
      },
    });
  });

  return ok(serializePayoutMethod(row), 201);
}
