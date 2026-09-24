import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { resolveAppUrl } from "@/lib/app-url";
import { createAssignmentSubmissionAccessUrl } from "@/lib/content-protection";
import { isLessonDripUnlocked } from "@/lib/drip-access";
import { isEnrolled } from "@/lib/enrollment";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";
import { saveProtectedFileToStorage } from "@/lib/storage";
import { validateStoredUrl } from "@/lib/url-validation";

const allowedSubmissionTypes = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const maxSubmissionBytes = 1024 * 1024 * 50;

async function saveAssignmentSubmissionFile(file: File | null) {
  const uploaded = await saveProtectedFileToStorage(file, {
    directory: "assignment-submissions",
    allowedTypes: allowedSubmissionTypes,
    maxBytes: maxSubmissionBytes,
    purpose: "Assignment submission",
  });
  return uploaded?.url || null;
}

function absoluteMediaUrl(baseUrl: string, value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//"))
    return `${baseUrl}${value}`;
  return value;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const student = await studentForRequest(request);
    if (!student) return fail("Unauthenticated", 401);

    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    const payload = isMultipart
      ? await request.formData()
      : ((await request.json().catch(() => ({}))) as Record<string, unknown>);
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment || !(await isEnrolled(student.id, assignment.courseId))) {
      return fail("Assignment not found", 404);
    }
    if (
      !(await isLessonDripUnlocked({
        userId: student.id,
        courseId: assignment.courseId,
        lessonId: assignment.lessonId,
      }))
    ) {
      return fail("Assignment is not unlocked yet.", 403);
    }
    if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) {
      return fail(
        "This assignment deadline has passed. Contact your instructor if you need a late submission exception.",
        422,
      );
    }

    const value = (key: string) =>
      isMultipart
        ? String((payload as FormData).get(key) || "")
        : String((payload as Record<string, unknown>)[key] || "");
    const content = value("content").trim();
    if (content.length < 10) {
      return fail("Submission content must be at least 10 characters.", 422);
    }
    const fileValue = isMultipart ? (payload as FormData).get("file") : null;
    const uploadedUrl = isMultipart
      ? await saveAssignmentSubmissionFile(
          fileValue instanceof File ? fileValue : null,
        )
      : null;
    const fileUrl = validateStoredUrl(value("fileUrl"), {
      label: "Submission file URL",
      allowRelative: true,
    });

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        userId: student.id,
        content,
        fileUrl: uploadedUrl || fileUrl || null,
      },
    });
    const appUrl = resolveAppUrl({
      headers: request.headers,
      requestOrigin: request.nextUrl.origin,
    });
    const signedFileUrl = absoluteMediaUrl(
      appUrl,
      await createAssignmentSubmissionAccessUrl({
        userId: student.id,
        courseId: assignment.courseId,
        submissionId: submission.id,
        url: submission.fileUrl,
      }),
    );

    return ok({
      id: submission.id,
      assignmentId: assignment.id,
      content: submission.content,
      fileUrl: signedFileUrl,
      grade: submission.grade,
      feedback: submission.feedback,
      status: "pending_review",
      createdAt: submission.createdAt.toISOString(),
    });
  } catch (error: any) {
    const message = error?.message || "Unable to submit assignment";
    return fail(message, message.includes("URL") ? 422 : 500);
  }
}
