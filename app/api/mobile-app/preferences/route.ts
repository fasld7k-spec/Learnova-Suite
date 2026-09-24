import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

const defaults = {
  email: true,
  inApp: true,
  marketing: false,
  liveReminders: true,
};

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export async function GET(request: NextRequest) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId: account.id },
  });

  return ok(
    preferences
      ? {
          email: preferences.email,
          inApp: preferences.inApp,
          marketing: preferences.marketing,
          liveReminders: preferences.liveReminders,
        }
      : defaults,
  );
}

export async function POST(request: NextRequest) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const existing =
    (await prisma.notificationPreference.findUnique({
      where: { userId: account.id },
    })) ?? defaults;

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: account.id },
    create: {
      userId: account.id,
      email: boolValue(body.email, existing.email),
      inApp: boolValue(body.inApp, existing.inApp),
      marketing: boolValue(body.marketing, existing.marketing),
      liveReminders: boolValue(body.liveReminders, existing.liveReminders),
    },
    update: {
      email: boolValue(body.email, existing.email),
      inApp: boolValue(body.inApp, existing.inApp),
      marketing: boolValue(body.marketing, existing.marketing),
      liveReminders: boolValue(body.liveReminders, existing.liveReminders),
    },
  });

  return ok({
    email: preferences.email,
    inApp: preferences.inApp,
    marketing: preferences.marketing,
    liveReminders: preferences.liveReminders,
  });
}
