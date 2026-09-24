import { NextRequest } from "next/server";
import { resolveAppUrl } from "@/lib/app-url";
import { createLessonMediaAccessUrl } from "@/lib/content-protection";

export function mobileRequestAppUrl(request: NextRequest) {
  return resolveAppUrl({
    headers: request.headers,
    requestOrigin: request.nextUrl?.origin ?? new URL(request.url).origin,
  });
}

export function absoluteMobileMediaUrl(baseUrl: string, value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//"))
    return `${baseUrl}${value}`;
  return value;
}

export async function mobileTeacherLessonMedia(args: {
  baseUrl: string;
  userId: string;
  courseId: string;
  lessonId: string;
  videoUrl?: string | null;
  attachmentUrl?: string | null;
}) {
  const [videoUrl, attachmentUrl] = await Promise.all([
    createLessonMediaAccessUrl({
      userId: args.userId,
      courseId: args.courseId,
      lessonId: args.lessonId,
      kind: "lesson-video",
      url: args.videoUrl ?? null,
    }),
    createLessonMediaAccessUrl({
      userId: args.userId,
      courseId: args.courseId,
      lessonId: args.lessonId,
      kind: "lesson-attachment",
      url: args.attachmentUrl ?? null,
    }),
  ]);

  const absoluteAttachmentUrl = absoluteMobileMediaUrl(
    args.baseUrl,
    attachmentUrl,
  );
  return {
    videoUrl: absoluteMobileMediaUrl(args.baseUrl, videoUrl),
    attachmentUrl: absoluteAttachmentUrl,
    resourceUrl: absoluteAttachmentUrl,
  };
}
