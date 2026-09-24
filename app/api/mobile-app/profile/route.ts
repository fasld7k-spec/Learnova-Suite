import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest, mobileUser } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);
  return ok(await mobileUser(account));
}

export async function POST(request: NextRequest) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || account.name).trim();
  const bio = Object.prototype.hasOwnProperty.call(body, "bio")
    ? String(body.bio || "").trim()
    : account.bio;
  const avatarUrl = Object.prototype.hasOwnProperty.call(body, "avatarUrl")
    ? String(body.avatarUrl || "").trim()
    : account.avatar;
  const locale = Object.prototype.hasOwnProperty.call(body, "locale")
    ? String(body.locale || account.locale || "en").trim()
    : account.locale || "en";

  if (!name) return fail("Name is required.", 422);

  const updated = await prisma.user.update({
    where: { id: account.id },
    data: {
      name,
      bio: bio || null,
      avatar: avatarUrl || null,
      locale: locale || "en",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      bio: true,
      locale: true,
    },
  });

  return ok(await mobileUser(updated));
}
