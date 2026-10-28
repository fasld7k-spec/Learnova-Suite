import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { createToken, hashPassword } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { anyFeatureEnabled, featureEnabled } from "@/lib/features";
import { mobileUser } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/site-settings";

export async function POST(req: NextRequest) {
  if (!rateLimit(`auth.register:${clientIp(req.headers)}`, 10, 15 * 60_000).ok) {
    return fail("Too many registration attempts. Try again later.", 429);
  }

  // Same switches as the web registration.
  const settings = await getSiteSettings();
  if (!settings.registrationEnabled) return fail("Registration is disabled", 403);
  if (await featureEnabled("registration_closed")) return fail("Registration is temporarily closed.", 403);

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
  if (role === "INSTRUCTOR" && !settings.instructorsEnabled) return fail("Instructor registration is disabled", 403);
  if (role === "INSTRUCTOR" && (await anyFeatureEnabled(["instructor_registration_closed"]))) {
    return fail("Instructor registration is temporarily closed.", 403);
  }

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
      // Teachers wait for admin approval, exactly like web registrations.
      status: role === "INSTRUCTOR" ? "PENDING" : "APPROVED",
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
