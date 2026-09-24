import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { resolveAppUrl } from "@/lib/app-url";
import { createAssignmentSubmissionAccessUrl } from "@/lib/content-protection";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

const revisionPrefix = "[NEEDS_REVISION] ";

function statusFor(submission: {
  grade: number | null;
  feedback: string | null;
}) {
  if (submission.feedback?.startsWith(revisionPrefix)) return "needs_revision";
  if (submission.grade !== null) return "graded";
  return "pending_review";
}

function absoluteMediaUrl(baseUrl: string, value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//"))
    return `${baseUrl}${value}`;
  return value;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const instructor = await instructorForRequest(request);
    if (!instructor) return fail("Unauthenticated", 401);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const outcome = String(body.outcome || "GRADED")
      .trim()
      .toUpperCase();
    const feedback = String(body.feedback || "").trim();
    const gradeValue =
      body.grade === null || body.grade === undefined
        ? ""
        : String(body.grade).trim();

    if (!["GRADED", "NEEDS_REVISION"].includes(outcome)) {
      return fail("Unsupported grading outcome.", 422);
    }
    if (outcome === "GRADED" && !gradeValue) {
      return fail("Grade is required when marking a submission graded.", 422);
    }
    const grade = gradeValue ? Number(gradeValue) : null;
    if (
      grade !== null &&
      (!Number.isInteger(grade) || grade < 0 || grade > 100)
    ) {
      return fail("Grade must be an integer from 0 to 100.", 422);
    }
    if (outcome === "NEEDS_REVISION" && feedback.length < 3) {
      return fail("Revision feedback is required.", 422);
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id },
    });
    if (!submission) return fail("Submission not found.", 404);

    const assignment = await prisma.assignment.findUnique({
      where: { id: submission.assignmentId },
    });
    if (!assignment) return fail("Submission not found.", 404);
    const course = await prisma.course.findUnique({
      where: { id: assignment.courseId },
      select: { instructorId: true, title: true },
    });
    if (!course || course.instructorId !== instructor.id) {
      return fail("Submission not found.", 404);
    }
    const student = await prisma.user.findUnique({
      where: { id: submission.userId },
      select: { name: true, email: true, avatar: true },
    });

    const nextFeedback =
      outcome === "NEEDS_REVISION"
        ? `${revisionPrefix}${feedback.replace(revisionPrefix, "")}`
        : feedback.replace(revisionPrefix, "");
    const updated = await prisma.assignmentSubmission.update({
      where: { id },
      data: {
        grade: outcome === "NEEDS_REVISION" ? null : grade,
        feedback: nextFeedback || null,
      },
    });

    await prisma.notification
      .create({
        data: {
          userId: submission.userId,
          title:
            outcome === "NEEDS_REVISION"
              ? "Assignment needs revision"
              : "Assignment graded",
          body:
            outcome === "NEEDS_REVISION"
              ? `${assignment.title} needs changes before final grading.`
              : `${assignment.title} was graded ${grade}/100.`,
        },
      })
      .catch(() => null);
    const appUrl = resolveAppUrl({
      headers: request.headers,
      requestOrigin: request.nextUrl.origin,
    });
    const fileUrl = absoluteMediaUrl(
      appUrl,
      await createAssignmentSubmissionAccessUrl({
        userId: instructor.id,
        courseId: assignment.courseId,
        submissionId: updated.id,
        url: updated.fileUrl,
      }),
    );

    return ok({
      id: updated.id,
      assignmentId: updated.assignmentId,
      assignmentTitle: assignment.title,
      courseId: assignment.courseId,
      courseTitle: course.title,
      lessonId: assignment.lessonId,
      studentId: updated.userId,
      studentName: student?.name ?? "Student",
      studentEmail: student?.email ?? "",
      studentAvatarUrl: student?.avatar ?? null,
      content: updated.content,
      fileUrl,
      grade: updated.grade,
      feedback: updated.feedback?.replace(revisionPrefix, "") ?? null,
      status: statusFor(updated),
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error: any) {
    return fail(error?.message || "Unable to grade submission.", 500);
  }
}
