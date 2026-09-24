import { ok } from "@/lib/api";
import {
  completedLessonIdsForStudent,
  findPublishedCourses,
  mobileCourse,
  studentForRequest,
} from "@/lib/mobile-app-adapter";

export async function GET(request: Request) {
  const courses = await findPublishedCourses();
  const student = await studentForRequest(request);
  const completedLessonIds = student
    ? await completedLessonIdsForStudent(
        student.id,
        courses.map((course) => course.id),
      )
    : new Set<string>();
  return ok(
    courses.map((course, index) =>
      mobileCourse(course, index < 4, completedLessonIds),
    ),
  );
}
