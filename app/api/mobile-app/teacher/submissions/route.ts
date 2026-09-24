import { fail, ok } from "@/lib/api";
import { resolveAppUrl } from "@/lib/app-url";
import { createAssignmentSubmissionAccessUrl } from "@/lib/content-protection";
import { instructorForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

function submissionStatus(submission: {
  grade: number | null;
  feedback: string | null;
}) {
  if (submission.feedback?.startsWith("[NEEDS_REVISION]"))
    return "needs_revision";
  if (submission.grade !== null) return "graded";
  return "pending_review";
}

function cleanFeedback(feedback: string | null) {
  return feedback?.replace("[NEEDS_REVISION] ", "") ?? null;
}

function absoluteMediaUrl(baseUrl: string, value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//"))
    return `${baseUrl}${value}`;
  return value;
}

export async function GET(request: Request) {
  const instructor = await instructorForRequest(request);
  if (!instructor) return fail("Unauthenticated", 401);

  const courses = await prisma.course.findMany({
    where: { instructorId: instructor.id },
    select: { id: true, title: true },
  });
  const courseIds = courses.map((course) => course.id);
  const assignments = courseIds.length
    ? await prisma.assignment.findMany({
        where: { courseId: { in: courseIds } },
        select: { id: true, courseId: true, title: true, lessonId: true },
      })
    : [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const submissions = assignmentIds.length
    ? await prisma.assignmentSubmission.findMany({
        where: { assignmentId: { in: assignmentIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const students = submissions.length
    ? await prisma.user.findMany({
        where: {
          id: { in: submissions.map((submission) => submission.userId) },
        },
        select: { id: true, name: true, email: true, avatar: true },
      })
    : [];

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );
  const studentById = new Map(students.map((student) => [student.id, student]));
  const appUrl = resolveAppUrl({
    headers: request.headers,
    requestOrigin: new URL(request.url).origin,
  });

  return ok(
    await Promise.all(
      submissions.map(async (submission) => {
        const assignment = assignmentById.get(submission.assignmentId);
        const course = assignment ? courseById.get(assignment.courseId) : null;
        const student = studentById.get(submission.userId);
        const fileUrl = assignment
          ? absoluteMediaUrl(
              appUrl,
              await createAssignmentSubmissionAccessUrl({
                userId: instructor.id,
                courseId: assignment.courseId,
                submissionId: submission.id,
                url: submission.fileUrl,
              }),
            )
          : null;
        return {
          id: submission.id,
          assignmentId: submission.assignmentId,
          assignmentTitle: assignment?.title ?? "Archived assignment",
          courseId: assignment?.courseId ?? "",
          courseTitle: course?.title ?? "Archived course",
          lessonId: assignment?.lessonId ?? null,
          studentId: submission.userId,
          studentName: student?.name ?? "Student",
          studentEmail: student?.email ?? "",
          studentAvatarUrl: student?.avatar ?? null,
          content: submission.content,
          fileUrl,
          grade: submission.grade,
          feedback: cleanFeedback(submission.feedback),
          status: submissionStatus(submission),
          createdAt: submission.createdAt.toISOString(),
        };
      }),
    ),
  );
}
