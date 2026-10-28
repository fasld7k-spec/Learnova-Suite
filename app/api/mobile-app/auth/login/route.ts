import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { mobileUser } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";
import { createToken, verifyPassword } from "@/lib/auth";
import { decryptSecret, verifyTOTP } from "@/lib/2fa";
import { logAuditEvent } from "@/lib/audit-log";
import { clientIp } from "@/lib/client-ip";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "@/lib/login-guard";
import { rateLimit } from "@/lib/rate-limit";

const DUMMY_PASSWORD_HASH = "$2a$12$IeeBglXrijDy1m3ROpJfzeoHAwyPQQVacWh734LUkTsj24/k0MnFi";

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`auth.login:${ip}`, 8, 60_000).ok) {
    return fail("Too many login attempts. Try again in a minute.", 429);
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .toLowerCase()
    .trim();
  const password = String(body.password || "");
  const totpToken = String(body.totpToken || "").trim();

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

  if (user && isLoginLocked(user.id)) {
    return fail("Too many failed login attempts. Try again in 15 minutes.", 429);
  }

  const passwordMatches = await verifyPassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    if (user) recordLoginFailure(user.id);
    void logAuditEvent({
      action: "auth.login.failure",
      userId: user?.id ?? null,
      ip,
      entity: "User",
      entityId: user?.id ?? null,
      details: { email, reason: "Invalid credentials", channel: "mobile" },
    });
    return fail("Invalid credentials", 401);
  }

  if (user.role === "ADMIN") {
    return fail("Mobile app supports student and teacher accounts only.", 403);
  }

  if (["SUSPENDED", "REJECTED"].includes(user.status)) {
    return fail("Account is not active.", 403);
  }

  // Same two-factor requirement as the web login.
  const twoFactor = await prisma.twoFactorAuth.findFirst({
    where: { userId: user.id, enabled: true },
  });
  if (twoFactor) {
    if (!totpToken) {
      // Same signal as the web login: the client asks for the code and retries with totpToken.
      return ok({ requiresTwoFactor: true });
    }
    let secret: string;
    try {
      secret = decryptSecret(twoFactor.secret);
    } catch {
      return fail("Internal error verifying 2FA", 500);
    }
    if (!verifyTOTP(totpToken, secret)) {
      recordLoginFailure(user.id);
      void logAuditEvent({
        action: "auth.login.failure",
        userId: user.id,
        ip,
        entity: "User",
        entityId: user.id,
        details: { email, reason: "Invalid TOTP token", channel: "mobile" },
      });
      return fail("Invalid TOTP token", 401);
    }
  }

  clearLoginFailures(user.id);
  void logAuditEvent({
    action: "auth.login.success",
    userId: user.id,
    ip,
    entity: "User",
    entityId: user.id,
    details: { email, channel: "mobile" },
  });

  return ok({
    ...(await mobileUser(user)),
    authToken: await createToken({
      id: user.id,
      role: user.role as "STUDENT" | "INSTRUCTOR",
      email: user.email,
    }),
  });
}
