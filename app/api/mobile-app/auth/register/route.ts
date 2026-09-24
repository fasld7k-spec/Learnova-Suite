import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { createToken, hashPassword } from "@/lib/auth";
import { mobileUser } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "")
    .toLowerCase()
    .trim();
  const password = String(body.password || "");
  const requestedRole = String(body.role || "student").toLowerCase();
  const role =
    requestedRole === "teacher"
      ? "INSTRUCTOR"
      : requestedRole === "student"
        ? "STUDENT"
        : null;

  if (!name || !email || password.length < 8) {
    return fail("Name, email, and an 8 character password are required.", 422);
  }
  if (!role)
    return fail(
      "Mobile app supports student and teacher registration only.",
      422,
    );

  const exists = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (exists) return fail("Email already exists", 409);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      status: "APPROVED",
    },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });

  return ok(
    {
      ...(await mobileUser(user)),
      authToken: await createToken({
        id: user.id,
        role,
        email: user.email,
      }),
    },
    201,
  );
}
