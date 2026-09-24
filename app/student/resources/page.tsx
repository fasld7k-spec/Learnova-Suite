import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StudentNotesClient } from '@/components/learn/StudentNotesClient';
import { requireUser } from '@/lib/auth';
import { createCourseResourceAccessUrl } from '@/lib/content-protection';
import { getCsrfToken } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export default async function StudentResources() {
  const user = await requireUser(['STUDENT']);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    select: { courseId: true, course: { select: { title: true, modules: { select: { lessons: { select: { id: true, title: true } } } } } } }
  });
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const rows = await prisma.courseResource.findMany({
    where: { courseId: { in: courseIds } },
    orderBy: { createdAt: 'desc' }
  });
  const [notes, csrfToken] = await Promise.all([
    prisma.courseNote.findMany({ where: { userId: user.id, courseId: { in: courseIds } }, orderBy: { updatedAt: 'desc' } }),
    getCsrfToken()
  ]);
  const protectedRows = await Promise.all(
    rows.map(async (resource) => ({
      ...resource,
      accessUrl: await createCourseResourceAccessUrl({
        userId: user.id,
        courseId: resource.courseId,
        resourceId: resource.id,
        url: resource.url
      })
    }))
  );

  return (
    <DashboardShell role="student" title="Resources & Notes">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-black text-white">Course resources</h2>
          <DataTable
            headers={['Title', 'Type', 'Access', 'Created']}
            rows={protectedRows.map((resource) => [
              resource.title,
              resource.type,
              resource.accessUrl ? (
                <a key="u" className="text-brand-600" href={resource.accessUrl} target="_blank" rel="noreferrer">
                  View protected file
                </a>
              ) : (
                'Unavailable'
              ),
              resource.createdAt.toLocaleDateString()
            ])}
          />
        </section>
        <StudentNotesClient
          csrfToken={csrfToken}
          initialNotes={notes.map((note) => ({
            ...note,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString()
          }))}
          courseOptions={enrollments.map((enrollment) => ({ id: enrollment.courseId, title: enrollment.course.title }))}
          lessonOptions={enrollments.flatMap((enrollment) =>
            enrollment.course.modules.flatMap((module) =>
              module.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, courseId: enrollment.courseId }))
            )
          )}
          allowCourseSelection
        />
      </div>
    </DashboardShell>
  );
}
