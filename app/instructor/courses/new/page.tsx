import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CourseCreateForm } from '@/components/instructor/CourseCreateForm';
import { getCsrfToken } from '@/lib/csrf';
import { getSiteSettings } from '@/lib/site-settings';
import { getAddonRuntime } from '@/lib/addons';

export default async function NewCourse(props: { searchParams?: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  await requireApprovedInstructor();
  const [cats, settings, csrfToken, liveAddon] = await Promise.all([
    prisma.category.findMany({ orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true } }),
    getSiteSettings(),
    getCsrfToken(),
    getAddonRuntime('live-class-booking')
  ]);

  return (
    <DashboardShell role="instructor" title="Create Course">
      {searchParams?.error ? (
        <div className="mb-6 border border-[#FFD400] bg-black p-4 text-sm font-bold text-[#FFD400]">
          {searchParams.error}
        </div>
      ) : null}
      <CourseCreateForm categories={cats} csrfToken={csrfToken} locale={settings.defaultLanguage} liveLessonsEnabled={liveAddon.active} />
    </DashboardShell>
  );
}
