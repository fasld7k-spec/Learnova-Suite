import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Bookmarks() {
  const user = await requireUser(['STUDENT']);
  const bookmarks = await prisma.lessonBookmark.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  const lessons = bookmarks.length
    ? await prisma.lesson.findMany({
        where: { id: { in: bookmarks.map((bookmark) => bookmark.lessonId) } },
        include: { module: { include: { course: true } } },
      })
    : [];
  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  return (
    <DashboardShell role="student" title="Lesson Bookmarks">
      <DataTable
        headers={['Lesson', 'Course', 'Note', 'Date']}
        rows={bookmarks.map((bookmark) => {
          const lesson = lessonMap.get(bookmark.lessonId);
          return [
            lesson?.title || 'Archived lesson',
            lesson?.module.course.title || '-',
            bookmark.note || '-',
            bookmark.createdAt.toLocaleDateString(),
          ];
        })}
      />
    </DashboardShell>
  );
}
