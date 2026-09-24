import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { mobileUser } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";
import { createToken, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .toLowerCase()
    .trim();
  const password = String(body.password || "");

  if (!email || !password) return fail("Email and password are required.", 422);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      status: true,
      passwordHash: true,
    },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("Invalid credentials", 401);
  }

  if (user.role === "ADMIN") {
    return fail("Mobile app supports student and teacher accounts only.", 403);
  }

  if (["SUSPENDED", "REJECTED"].includes(user.status)) {
    return fail("Account is not active.", 403);
  }

  return ok({
    ...(await mobileUser(user)),
    authToken: await createToken({
      id: user.id,
      role: user.role as "STUDENT" | "INSTRUCTOR",
      email: user.email,
    }),
  });
}
