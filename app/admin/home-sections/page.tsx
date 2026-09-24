import Link from 'next/link';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { getHomeSectionSettings } from '@/lib/home-sections';
import { homeThemeRegistry } from '@/lib/home-theme-registry';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function HomeSections(props: { searchParams?: Promise<{ saved?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);

  const [slides, activeSlides, publishedCourses, categories, instructors, reviews, subscriptionPlans, blogPosts, configuredSections] = await Promise.all([
    prisma.slider.count(),
    prisma.slider.count({ where: { active: true } }),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.category.count(),
    prisma.user.count({ where: { role: 'INSTRUCTOR', status: 'APPROVED' } }),
    prisma.review.count(),
    prisma.subscriptionPlan.count({ where: { active: true } }),
    prisma.blogPost.count({ where: { published: true } }),
    getHomeSectionSettings(),
  ]);

  const metrics: Record<string, { metric: string; ready: boolean }> = {
    heroSlider: { metric: `${activeSlides}/${slides} active`, ready: activeSlides > 0 },
    featuredCourses: { metric: `${publishedCourses} published`, ready: publishedCourses > 0 },
    categories: { metric: `${categories} categories`, ready: categories > 0 },
    instructors: { metric: `${instructors} approved`, ready: instructors > 0 },
    reviews: { metric: `${reviews} reviews`, ready: reviews > 0 },
    subscriptions: { metric: `${subscriptionPlans} active`, ready: subscriptionPlans > 0 },
    blog: { metric: `${blogPosts} published`, ready: blogPosts > 0 },
  };
  const enabledCount = configuredSections.filter((section) => section.enabled).length;

  return (
    <DashboardShell role="admin" title="Home Sections">
      {searchParams?.saved && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          Homepage section settings saved.
        </div>
      )}

      <div className="card mb-6">
        <h2 className="text-xl font-black text-white">Homepage control center</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#71767B]">
          Enable or disable the data-backed homepage sections, customize their admin labels, and jump to the exact module that feeds each block.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="blue">{homeThemeRegistry.length} themes</Badge>
          <Badge tone={enabledCount ? 'green' : 'yellow'}>{enabledCount}/{configuredSections.length} sections enabled</Badge>
          <Link href="/admin/theme" className="btn-secondary">Theme manager</Link>
          <Link href="/?previewTheme=theme-7" className="btn-secondary">Preview homepage</Link>
        </div>
      </div>

      <form className="grid gap-4" action="/api/admin/home-sections" method="post">
          <CsrfInput />
        {configuredSections.map((section) => {
          const status = metrics[section.key] || { metric: 'Configured', ready: true };
          return (
            <section className="card" key={section.key}>
              <div className="grid gap-4 lg:grid-cols-[1fr_220px_150px_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-white">{section.title}</h2>
                    <Badge tone={section.enabled ? 'green' : 'red'}>{section.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    <Badge tone={status.ready ? 'green' : 'yellow'}>{status.ready ? 'Ready' : 'Needs data'}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#71767B]">{section.description}</p>
                  <p className="mt-3 text-sm font-black text-[#1D9BF0]">{status.metric}</p>
                </div>
                <label className="text-sm font-bold text-[#E7E9EA]">
                  Admin label
                  <input className="input mt-2" name={`${section.key}_title`} defaultValue={section.title} />
                </label>
                <label className="text-sm font-bold text-[#E7E9EA]">
                  Sort
                  <input className="input mt-2" name={`${section.key}_sortOrder`} type="number" min="1" defaultValue={section.sortOrder} />
                </label>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <label className="flex items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
                    <input type="checkbox" name={`${section.key}_enabled`} defaultChecked={section.enabled} /> Show
                  </label>
                  <Link className="btn-secondary" href={section.href}>Manage data</Link>
                </div>
              </div>
            </section>
          );
        })}

        <div className="sticky bottom-4 z-10 border border-[#2F3336] bg-black/95 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#71767B]">
              Saved changes affect the live homepage data feeds immediately. Theme-specific text and visuals remain editable from Theme manager.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link className="btn-secondary" href="/admin/theme">Customize theme</Link>
              <button className="btn-primary">Save homepage sections</button>
            </div>
          </div>
        </div>
      </form>
    </DashboardShell>
  );
}
