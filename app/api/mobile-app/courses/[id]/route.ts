import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import {
  completedLessonIdsForStudent,
  findPublishedCourses,
  mobileCourse,
  studentForRequest,
} from "@/lib/mobile-app-adapter";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const courses = await findPublishedCourses();
  const course = courses.find((item) => item.id === id || item.slug === id);
  if (!course) return fail("Course not found", 404);
  const student = await studentForRequest(_req);
  const completedLessonIds = student
    ? await completedLessonIdsForStudent(student.id, [course.id])
    : new Set<string>();
  return ok(mobileCourse(course, true, completedLessonIds));
}
