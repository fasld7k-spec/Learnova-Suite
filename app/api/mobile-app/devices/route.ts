import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

const DEFAULT_DEVICE_PROVIDER = "firebase_messaging";
const DEFAULT_DEVICE_PLATFORM = "mobile";

const deviceSelect = {
  id: true,
  name: true,
  token: true,
  provider: true,
  platform: true,
  lastSeen: true,
} as const;

const compatibilityDeviceSelect = {
  id: true,
  name: true,
  token: true,
  lastSeen: true,
} as const;

type PublicDeviceRecord = {
  id: string;
  name: string;
  token: string | null;
  provider?: string | null;
  platform?: string | null;
  lastSeen: Date;
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value: unknown) {
  const token = textValue(value);
  return token.length >= 20 && token.length <= 4096 ? token : "";
}

function normalizeMetadata(
  value: unknown,
  fallback: string,
  maxLength: number,
) {
  return (textValue(value) || fallback).slice(0, maxLength);
}

function isDeviceMetadataColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "P2022") return true;
  return (
    /provider|platform/i.test(error.message) &&
    /column|does not exist|no such column|unknown|not found/i.test(
      error.message,
    )
  );
}

function publicDevice(
  device: PublicDeviceRecord,
  metadata?: { provider?: string; platform?: string },
) {
  return {
    id: device.id,
    name: device.name,
    provider: device.provider ?? metadata?.provider ?? DEFAULT_DEVICE_PROVIDER,
    platform: device.platform ?? metadata?.platform ?? DEFAULT_DEVICE_PLATFORM,
    lastSeen: device.lastSeen.toISOString(),
  };
}

async function findDevicesForUser(userId: string) {
  try {
    return await prisma.userDevice.findMany({
      where: { userId },
      select: deviceSelect,
      orderBy: { lastSeen: "desc" },
      take: 25,
    });
  } catch (error) {
    if (!isDeviceMetadataColumnError(error)) throw error;

    return prisma.userDevice.findMany({
      where: { userId },
      select: compatibilityDeviceSelect,
      orderBy: { lastSeen: "desc" },
      take: 25,
    });
  }
}

export async function GET(request: NextRequest) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const devices = await findDevicesForUser(account.id);

  return ok(devices.map((device) => publicDevice(device)));
}

export async function POST(request: NextRequest) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const token = normalizeToken(body.token);
  if (!token) return fail("A valid device token is required.", 422);

  const platform = normalizeMetadata(
    body.platform,
    DEFAULT_DEVICE_PLATFORM,
    40,
  );
  const provider = normalizeMetadata(
    body.provider,
    DEFAULT_DEVICE_PROVIDER,
    80,
  );
  const fallbackName = `${platform} ${provider}`.slice(0, 120);
  const name = (textValue(body.name) || fallbackName).slice(0, 120);
  const lastSeen = new Date();

  const existing = await prisma.userDevice.findFirst({
    where: { userId: account.id, token },
    select: { id: true },
  });

  let device: PublicDeviceRecord;

  try {
    device = existing
      ? await prisma.userDevice.update({
          where: { id: existing.id },
          data: { name, provider, platform, lastSeen },
          select: deviceSelect,
        })
      : await prisma.userDevice.create({
          data: {
            userId: account.id,
            name,
            token,
            provider,
            platform,
            lastSeen,
          },
          select: deviceSelect,
        });
  } catch (error) {
    if (!isDeviceMetadataColumnError(error)) throw error;

    device = existing
      ? await prisma.userDevice.update({
          where: { id: existing.id },
          data: { name, lastSeen },
          select: compatibilityDeviceSelect,
        })
      : await prisma.userDevice.create({
          data: {
            userId: account.id,
            name,
            token,
            lastSeen,
          },
          select: compatibilityDeviceSelect,
        });
  }

  return ok(publicDevice(device, { provider, platform }));
}

export async function DELETE(request: NextRequest) {
  const account = await mobileAccountForRequest(request);
  if (!account) return fail("Unauthenticated", 401);

  const body = await request.json().catch(() => ({}));
  const id = textValue(body.id);
  const token = normalizeToken(body.token);
  if (!id && !token)
    return fail("A valid device id or token is required.", 422);

  await prisma.userDevice.deleteMany({
    where: {
      userId: account.id,
      ...(id ? { id } : { token }),
    },
  });

  return ok({ removed: true });
}
