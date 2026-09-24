import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { appUrlFromRequest } from "@/lib/app-url";
import { createPasswordResetToken } from "@/lib/auth";
import { renderEmailTemplate, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

function requestIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

function isValidEmail(email: string) {
  return email.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(`mobile.auth.forgot:${requestIp(req)}`, 5, 60_000);
  if (!limited.ok)
    return fail("Too many recovery attempts. Try again in a minute.", 429);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const user = isValidEmail(email)
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  if (user) {
    const resetToken = await createPasswordResetToken({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
    });
    const resetUrl = `${appUrlFromRequest(req)}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const emailContent = await renderEmailTemplate("password-reset", {
      name: user.name,
      resetUrl,
      expiresIn: "30 minutes",
    }).catch(() => ({
      subject: "Password reset",
      html: `<h1>Password reset</h1><p>Use this password reset link within 30 minutes: <a href="${resetUrl}">${resetUrl}</a></p>`,
    }));

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
  }

  return ok({ message: "If the email exists, reset instructions were sent." });
}
