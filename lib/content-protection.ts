import { createHmac, timingSafeEqual } from "crypto";
import { decryptSecret, encryptSecret } from "@/lib/secret-fields";
import { prisma } from "@/lib/prisma";
import { isLessonDripUnlocked } from "@/lib/drip-access";

export type ProtectedResourceKind =
  | "lesson-video"
  | "lesson-attachment"
  | "course-resource"
  | "assignment-submission";

export type ContentProtectionSettings = {
  enabled: boolean;
  signedUrls: boolean;
  ttlSeconds: number;
  requireEnrollment: boolean;
  allowPreviewLessons: boolean;
  watermarkDownloads: boolean;
  watermarkLogoUrl: string;
  signingSecret: string;
};

export type SignedResourcePayload = {
  kind: ProtectedResourceKind;
  userId: string;
  courseId: string;
  lessonId?: string;
  resourceId?: string;
  submissionId?: string;
  url?: string;
  exp: number;
};

export type AccessCheckResult =
  | { allowed: true; courseId: string; url: string; reason: string }
  | { allowed: false; status: number; reason: string };

export const CONTENT_PROTECTION_SETTING_KEY = "contentProtection";

const defaults: ContentProtectionSettings = {
  enabled: true,
  signedUrls: true,
  ttlSeconds: 900,
  requireEnrollment: true,
  allowPreviewLessons: true,
  watermarkDownloads: true,
  watermarkLogoUrl: "",
  signingSecret: "",
};

function signingSecret(secretOverride?: string) {
  const secret =
    secretOverride ||
    process.env.CONTENT_PROTECTION_SECRET ||
    process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CONTENT_PROTECTION_SECRET or JWT_SECRET is required for protected media tokens.",
    );
  }
  return "dev-content-protection-secret";
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signBody(body: string, secretOverride?: string) {
  return createHmac("sha256", signingSecret(secretOverride))
    .update(body)
    .digest("base64url");
}

function parseBoolean(value: FormDataEntryValue | null, fallback: boolean) {
  if (value === null) return false;
  return value === "on" || value === "true" || value === "1";
}

function safeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  throw new Error(
    "Only absolute http(s) or site-relative media URLs can be protected.",
  );
}

export async function getContentProtectionSettings(): Promise<ContentProtectionSettings> {
  const row = await prisma.setting.findUnique({
    where: { key: CONTENT_PROTECTION_SETTING_KEY },
  });
  if (!row) return defaults;
  try {
    const parsed = JSON.parse(row.value);
    return {
      ...defaults,
      ...parsed,
      signingSecret: decryptSecret(parsed.signingSecret),
    };
  } catch {
    return defaults;
  }
}

export async function saveContentProtectionSettings(form: FormData) {
  const current = await getContentProtectionSettings();
  const nextSigningSecret =
    String(form.get("signingSecret") || "").trim() || current.signingSecret;
  const next: ContentProtectionSettings = {
    enabled: parseBoolean(form.get("enabled"), defaults.enabled),
    signedUrls: parseBoolean(form.get("signedUrls"), defaults.signedUrls),
    ttlSeconds: Math.min(
      86400,
      Math.max(60, Number(form.get("ttlSeconds") || defaults.ttlSeconds)),
    ),
    requireEnrollment: parseBoolean(
      form.get("requireEnrollment"),
      defaults.requireEnrollment,
    ),
    allowPreviewLessons: parseBoolean(
      form.get("allowPreviewLessons"),
      defaults.allowPreviewLessons,
    ),
    watermarkDownloads: parseBoolean(
      form.get("watermarkDownloads"),
      defaults.watermarkDownloads,
    ),
    watermarkLogoUrl: String(form.get("watermarkLogoUrl") || "").trim(),
    signingSecret: encryptSecret(nextSigningSecret),
  };
  await prisma.setting.upsert({
    where: { key: CONTENT_PROTECTION_SETTING_KEY },
    update: { value: JSON.stringify(next) },
    create: {
      key: CONTENT_PROTECTION_SETTING_KEY,
      value: JSON.stringify(next),
    },
  });
  return { ...next, signingSecret: nextSigningSecret };
}

export function signResourceAccess(
  payload: Omit<SignedResourcePayload, "exp">,
  ttlSeconds: number,
  secretOverride?: string,
) {
  const body = encode({
    ...payload,
    ...(payload.url ? { url: safeUrl(payload.url) } : {}),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  return `${body}.${signBody(body, secretOverride)}`;
}

export function verifyResourceAccessToken(
  token: string,
  secretOverride?: string,
): SignedResourcePayload {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("Invalid media token.");
  const expected = signBody(body, secretOverride);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected))
    throw new Error("Invalid media token signature.");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    throw new Error("Invalid media token signature.");
  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as SignedResourcePayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000))
    throw new Error("Media token expired.");
  if (payload.url) safeUrl(payload.url);
  return payload;
}

export function mediaAccessUrl(token: string) {
  return `/api/media/access?token=${encodeURIComponent(token)}`;
}

export async function createLessonMediaAccessUrl(args: {
  userId: string;
  courseId: string;
  lessonId: string;
  kind: Extract<ProtectedResourceKind, "lesson-video" | "lesson-attachment">;
  url: string | null;
  ttlSeconds?: number;
}) {
  if (!args.url) return null;
  const settings = await getContentProtectionSettings();
  if (!settings.enabled || !settings.signedUrls) return args.url;
  return mediaAccessUrl(
    signResourceAccess(
      {
        kind: args.kind,
        userId: args.userId,
        courseId: args.courseId,
        lessonId: args.lessonId,
      },
      args.ttlSeconds || settings.ttlSeconds,
      settings.signingSecret,
    ),
  );
}

export async function createCourseResourceAccessUrl(args: {
  userId: string;
  courseId: string;
  resourceId: string;
  url: string | null;
  ttlSeconds?: number;
}) {
  if (!args.url) return null;
  const settings = await getContentProtectionSettings();
  if (!settings.enabled || !settings.signedUrls) return args.url;
  return mediaAccessUrl(
    signResourceAccess(
      {
        kind: "course-resource",
        userId: args.userId,
        courseId: args.courseId,
        resourceId: args.resourceId,
      },
      args.ttlSeconds || settings.ttlSeconds,
      settings.signingSecret,
    ),
  );
}

export async function createAssignmentSubmissionAccessUrl(args: {
  userId: string;
  courseId: string;
  submissionId: string;
  url: string | null;
  ttlSeconds?: number;
}) {
  if (!args.url) return null;
  const settings = await getContentProtectionSettings();
  if (!settings.enabled || !settings.signedUrls) return args.url;
  return mediaAccessUrl(
    signResourceAccess(
      {
        kind: "assignment-submission",
        userId: args.userId,
        courseId: args.courseId,
        submissionId: args.submissionId,
      },
      args.ttlSeconds || settings.ttlSeconds,
      settings.signingSecret,
    ),
  );
}

export async function checkSignedResourceAccess(
  payload: SignedResourcePayload,
  currentUser: { id: string; role: string },
): Promise<AccessCheckResult> {
  const settings = await getContentProtectionSettings();
  if (currentUser.role !== "ADMIN" && currentUser.id !== payload.userId) {
    return {
      allowed: false,
      status: 403,
      reason: "token belongs to another user",
    };
  }

  if (payload.kind === "course-resource") {
    if (!payload.resourceId)
      return { allowed: false, status: 400, reason: "missing resource id" };
    return checkCourseResourceAccess(
      currentUser,
      payload.resourceId,
      payload.url,
      settings,
    );
  }

  if (payload.kind === "assignment-submission") {
    if (!payload.submissionId)
      return { allowed: false, status: 400, reason: "missing submission id" };
    return checkAssignmentSubmissionAccess(
      currentUser,
      payload.submissionId,
      payload.url,
      settings,
    );
  }

  if (!payload.lessonId)
    return { allowed: false, status: 400, reason: "missing lesson id" };
  return checkLessonMediaAccess(
    currentUser,
    payload.lessonId,
    payload.kind,
    payload.url,
    settings,
  );
}

export async function checkLessonMediaAccess(
  currentUser: { id: string; role: string },
  lessonId: string,
  kind: Extract<
    ProtectedResourceKind,
    "lesson-video" | "lesson-attachment"
  > = "lesson-video",
  url?: string,
  settings?: ContentProtectionSettings,
): Promise<AccessCheckResult> {
  const activeSettings = settings || (await getContentProtectionSettings());
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isPreview: true,
      videoUrl: true,
      attachmentUrl: true,
      module: { select: { courseId: true } },
    },
  });
  if (!lesson)
    return { allowed: false, status: 404, reason: "lesson not found" };
  const storedUrl =
    kind === "lesson-attachment" ? lesson.attachmentUrl : lesson.videoUrl;
  const targetUrl = storedUrl;
  if (!targetUrl)
    return { allowed: false, status: 404, reason: "lesson has no media URL" };
  if (url && storedUrl && url !== storedUrl)
    return {
      allowed: false,
      status: 403,
      reason: "media token does not match the lesson source",
    };
  if (!activeSettings.enabled)
    return {
      allowed: true,
      courseId: lesson.module.courseId,
      url: targetUrl,
      reason: "protection disabled",
    };
  if (currentUser.role === "ADMIN")
    return {
      allowed: true,
      courseId: lesson.module.courseId,
      url: targetUrl,
      reason: "admin access",
    };
  if (currentUser.role === "INSTRUCTOR") {
    const course = await prisma.course.findUnique({
      where: { id: lesson.module.courseId },
      select: { instructorId: true },
    });
    if (course?.instructorId === currentUser.id) {
      return {
        allowed: true,
        courseId: lesson.module.courseId,
        url: targetUrl,
        reason: "instructor owner access",
      };
    }
  }
  if (activeSettings.allowPreviewLessons && lesson.isPreview)
    return {
      allowed: true,
      courseId: lesson.module.courseId,
      url: targetUrl,
      reason: "preview lesson",
    };
  if (!activeSettings.requireEnrollment)
    return {
      allowed: true,
      courseId: lesson.module.courseId,
      url: targetUrl,
      reason: "enrollment check disabled",
    };
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: currentUser.id,
        courseId: lesson.module.courseId,
      },
    },
    select: { id: true },
  });
  if (!enrollment)
    return {
      allowed: false,
      status: 403,
      reason: "course purchase/enrollment required",
    };
  if (
    !(await isLessonDripUnlocked({
      userId: currentUser.id,
      courseId: lesson.module.courseId,
      lessonId,
    }))
  )
    return { allowed: false, status: 403, reason: "lesson is not unlocked yet" };
  return {
    allowed: true,
    courseId: lesson.module.courseId,
    url: targetUrl,
    reason: "enrolled learner",
  };
}

export async function checkCourseResourceAccess(
  currentUser: { id: string; role: string },
  resourceId: string,
  url?: string,
  settings?: ContentProtectionSettings,
): Promise<AccessCheckResult> {
  const activeSettings = settings || (await getContentProtectionSettings());
  const resource = await prisma.courseResource.findUnique({
    where: { id: resourceId },
  });
  if (!resource)
    return { allowed: false, status: 404, reason: "resource not found" };
  const targetUrl = resource.url;
  if (url && url !== resource.url)
    return {
      allowed: false,
      status: 403,
      reason: "media token does not match the course resource",
    };
  if (!activeSettings.enabled)
    return {
      allowed: true,
      courseId: resource.courseId,
      url: targetUrl,
      reason: "protection disabled",
    };
  if (currentUser.role === "ADMIN")
    return {
      allowed: true,
      courseId: resource.courseId,
      url: targetUrl,
      reason: "admin access",
    };
  const course = await prisma.course.findUnique({
    where: { id: resource.courseId },
    select: { instructorId: true },
  });
  if (course?.instructorId === currentUser.id)
    return {
      allowed: true,
      courseId: resource.courseId,
      url: targetUrl,
      reason: "instructor owner access",
    };
  if (!activeSettings.requireEnrollment)
    return {
      allowed: true,
      courseId: resource.courseId,
      url: targetUrl,
      reason: "enrollment check disabled",
    };
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId: currentUser.id, courseId: resource.courseId },
    },
    select: { id: true },
  });
  return enrollment
    ? {
        allowed: true,
        courseId: resource.courseId,
        url: targetUrl,
        reason: "enrolled learner",
      }
    : {
        allowed: false,
        status: 403,
        reason: "course purchase/enrollment required",
      };
}

export async function checkAssignmentSubmissionAccess(
  currentUser: { id: string; role: string },
  submissionId: string,
  url?: string,
  settings?: ContentProtectionSettings,
): Promise<AccessCheckResult> {
  const activeSettings = settings || (await getContentProtectionSettings());
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!submission?.fileUrl)
    return { allowed: false, status: 404, reason: "submission file not found" };
  if (url && url !== submission.fileUrl)
    return {
      allowed: false,
      status: 403,
      reason: "media token does not match the submission source",
    };
  const assignment = await prisma.assignment.findUnique({
    where: { id: submission.assignmentId },
  });
  if (!assignment)
    return { allowed: false, status: 404, reason: "assignment not found" };
  if (!activeSettings.enabled)
    return {
      allowed: true,
      courseId: assignment.courseId,
      url: submission.fileUrl,
      reason: "protection disabled",
    };
  if (currentUser.role === "ADMIN")
    return {
      allowed: true,
      courseId: assignment.courseId,
      url: submission.fileUrl,
      reason: "admin access",
    };
  if (currentUser.role === "STUDENT" && submission.userId === currentUser.id) {
    return {
      allowed: true,
      courseId: assignment.courseId,
      url: submission.fileUrl,
      reason: "submission owner access",
    };
  }
  if (currentUser.role === "INSTRUCTOR") {
    const course = await prisma.course.findUnique({
      where: { id: assignment.courseId },
      select: { instructorId: true },
    });
    if (course?.instructorId === currentUser.id) {
      return {
        allowed: true,
        courseId: assignment.courseId,
        url: submission.fileUrl,
        reason: "instructor owner access",
      };
    }
  }
  return { allowed: false, status: 403, reason: "submission access denied" };
}
