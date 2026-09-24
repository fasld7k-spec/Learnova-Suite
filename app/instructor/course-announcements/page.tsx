import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export default async function CourseAnnouncements() {
  const user = await requireUser(['INSTRUCTOR']);
  const [courses, settings] = await Promise.all([
    prisma.course.findMany({ where: { instructorId: user.id }, orderBy: { title: 'asc' } }),
    getSiteSettings()
  ]);
  const rows = await prisma.courseAnnouncement.findMany({ where: { courseId: { in: courses.map((course) => course.id) } }, orderBy: { createdAt: 'desc' } });
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);

  return (
    <DashboardShell role="instructor" title="Course Announcements">
      <form className="card mb-6 grid gap-3" action="/api/instructor/course-announcements" method="post">
        <CsrfInput />
        <select className="input" name="courseId" required>
          <option value="">{t('Select course')}</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <input className="input" name="title" placeholder={t('Title')} required />
        <textarea className="input min-h-28" name="body" placeholder={t('Announcement')} required />
        <button className="btn-primary w-fit">{t('Publish')}</button>
      </form>
      <DataTable
        headers={['Title', 'Course', 'Date', 'Manage'].map(t)}
        rows={rows.map((row) => [
          row.title,
          courseTitles.get(row.courseId) || t('Archived course'),
          row.createdAt.toLocaleString(),
          <form key="delete" action="/api/instructor/course-announcements" method="post">
            <CsrfInput />
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="announcementId" value={row.id} />
            <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">{t('Delete')}</button>
          </form>
        ])}
      />
    </DashboardShell>
  );
}
