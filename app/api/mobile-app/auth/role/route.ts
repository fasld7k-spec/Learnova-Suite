import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { createToken } from "@/lib/auth";
import { mobileAccountForRequest, mobileUser } from "@/lib/mobile-app-adapter";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const role = String(body.role || "").toLowerCase();
  const mobileRole =
    role === "teacher" ? "teacher" : role === "student" ? "student" : null;

  if (!mobileRole) return fail("Unsupported role.", 422);

  const dbRole = mobileRole === "teacher" ? "INSTRUCTOR" : "STUDENT";
  const user = await mobileAccountForRequest(req);
  if (!user) return fail("Sign in before changing your mobile role.", 401);
  if (user.role !== dbRole) {
    return fail("This account does not match the requested role.", 403);
  }

  return ok({
    ...(await mobileUser(user)),
    authToken: await createToken({
      id: user.id,
      role: dbRole,
      email: user.email,
    }),
  });
}
