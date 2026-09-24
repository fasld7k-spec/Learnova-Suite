import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { fail, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  checkSignedResourceAccess,
  getContentProtectionSettings,
  verifyResourceAccessToken,
} from "@/lib/content-protection";
import { mobileAccountForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";
import { fetchProtectedStoredFile } from "@/lib/storage";

function protectedMediaHeaders(upstream: Response) {
  const headers = new Headers();
  const passThrough = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
    "etag",
  ];

  for (const key of passThrough) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set("Cache-Control", "no-store, private, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Content-Disposition", 'inline; filename="protected-media"');
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "picture-in-picture=(), display-capture=()",
  );
  return headers;
}

function mediaContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".zip") return "application/zip";
  return "application/octet-stream";
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}

function allowedMediaHosts() {
  const configured = String(process.env.MEDIA_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([
    "interactive-examples.mdn.mozilla.net",
    "iframe.mediadelivery.net",
    ...configured,
  ]);
}

function assertFetchableMediaUrl(url: string, req: NextRequest) {
  const parsed = new URL(url, req.url);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("Unsupported protected media URL protocol.");
  const requestHost = req.nextUrl.hostname.toLowerCase();
  const targetHost = parsed.hostname.toLowerCase();
  const sameOrigin = targetHost === requestHost;
  if (!sameOrigin && isPrivateHostname(targetHost))
    throw new Error("Private media hosts cannot be proxied.");
  if (
    process.env.NODE_ENV === "production" &&
    !sameOrigin &&
    !allowedMediaHosts().has(targetHost)
  ) {
    throw new Error("Protected media host is not in MEDIA_ALLOWED_HOSTS.");
  }
  return parsed;
}

async function streamLocalProtectedMedia(url: string, req: NextRequest) {
  const parsed = new URL(url, req.url);
  const pathname = decodeURIComponent(parsed.pathname);
  const relative = pathname.replace(/^\/protected-uploads\/?/, "");
  const root = path.resolve(process.cwd(), "storage", "protected-uploads");
  const filePath = path.resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`))
    return fail("Invalid protected media path.", 400);

  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return fail("Protected media file not found.", 404);

  const headers = protectedMediaHeaders(
    new Response(null, {
      headers: {
        "content-type": mediaContentType(filePath),
        "accept-ranges": "bytes",
        "content-length": String(info.size),
      },
    }),
  );

  const range = req.headers.get("range");
  if (range?.startsWith("bytes=")) {
    const [startRaw, endRaw] = range.replace("bytes=", "").split("-");
    const start = Number(startRaw || 0);
    const end = endRaw ? Number(endRaw) : info.size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      start >= info.size
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${info.size}` },
      });
    }

    const cappedEnd = Math.min(end, info.size - 1);
    headers.set("Content-Length", String(cappedEnd - start + 1));
    headers.set("Content-Range", `bytes ${start}-${cappedEnd}/${info.size}`);
    return new Response(
      createReadStream(filePath, { start, end: cappedEnd }) as any,
      { status: 206, headers },
    );
  }

  return new Response(createReadStream(filePath) as any, {
    status: 200,
    headers,
  });
}

async function streamProtectedMedia(url: string, req: NextRequest) {
  if (url.startsWith("/protected-uploads/"))
    return streamLocalProtectedMedia(url, req);

  const storedObject = await fetchProtectedStoredFile(url, {
    range: req.headers.get("range"),
    accept: req.headers.get("accept"),
  });
  if (storedObject) {
    if (!storedObject.ok && storedObject.status !== 206) {
      return fail(
        `Protected storage source returned HTTP ${storedObject.status}`,
        storedObject.status,
      );
    }
    return new Response(storedObject.body, {
      status: storedObject.status,
      headers: protectedMediaHeaders(storedObject),
    });
  }

  const upstream = await fetch(assertFetchableMediaUrl(url, req), {
    headers: {
      ...(req.headers.get("range")
        ? { Range: req.headers.get("range") as string }
        : {}),
      ...(req.headers.get("accept")
        ? { Accept: req.headers.get("accept") as string }
        : {}),
    },
    cache: "no-store",
    redirect: "manual",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return fail(
      `Protected media source returned HTTP ${upstream.status}`,
      upstream.status,
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: protectedMediaHeaders(upstream),
  });
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return fail("Missing media token", 400);

    const settings = await getContentProtectionSettings();
    const payload = verifyResourceAccessToken(token, settings.signingSecret);
    const session = await getSession();
    const webUser = session
      ? await prisma.user.findUnique({
          where: { id: session.id },
          select: { id: true, role: true, status: true },
        })
      : null;
    const mobileUser = webUser ? null : await mobileAccountForRequest(req);
    const signedUrlUser =
      webUser || mobileUser
        ? null
        : await prisma.user.findFirst({
            where: { id: payload.userId, status: { not: "SUSPENDED" } },
            select: { id: true, role: true },
          });
    const currentUser = webUser || mobileUser || signedUrlUser;
    if (
      !currentUser ||
      !["STUDENT", "INSTRUCTOR", "ADMIN"].includes(currentUser.role)
    )
      return fail("Forbidden", 403);

    const access = await checkSignedResourceAccess(payload, currentUser);
    await prisma.auditLog
      .create({
        data: {
          actorId: currentUser.id,
          action: access.allowed
            ? "media.access.allowed"
            : "media.access.denied",
          entity: payload.kind,
          entityId:
            payload.lessonId ||
            payload.resourceId ||
            payload.submissionId ||
            payload.courseId,
          metadata: JSON.stringify({
            courseId: payload.courseId,
            reason: access.reason,
          }),
        },
      })
      .catch(() => null);

    if (!access.allowed) return fail(access.reason, access.status);
    return streamProtectedMedia(access.url, req);
  } catch (e) {
    return handleError(e);
  }
}
