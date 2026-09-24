import { FolderOpen } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CourseCard } from '@/components/CourseCard';
import { EmptyState } from '@/components/EmptyState';
import { localizedPageCopy } from '@/lib/page-copy';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, cleanDescription, jsonLd, seo } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site-settings';
import { currentAppUrl } from '@/lib/request-url';
import { notFound } from 'next/navigation';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const category = await prisma.category.findUnique({
    where: { slug: params.slug },
    include: { courses: { where: { status: 'PUBLISHED' }, select: { id: true } } },
  });
  if (!category) {
    return seo({ title: 'Category not found', description: 'This course category is not available.', path: `/categories/${params.slug}`, baseUrl: await currentAppUrl() });
  }

  const description = cleanDescription(
    `Browse ${category.courses.length} courses in ${category.nameEn}${category.nameAr ? ` (${category.nameAr})` : ''}.`
  );

  return seo({
    title: `${category.nameEn} Courses`,
    description,
    path: `/categories/${category.slug}`,
    baseUrl: await currentAppUrl(),
  });
}

export default async function CategoryPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const [category, settings] = await Promise.all([
    prisma.category.findUnique({
      where: { slug: params.slug },
      include: {
        courses: {
          where: { status: 'PUBLISHED' },
          include: { category: true, instructor: true, reviews: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    getSiteSettings(),
  ]);
  if (!category) notFound();
  const copy = localizedPageCopy(settings.defaultLanguage).catalog;
  const appUrl = await currentAppUrl(settings.publicAppUrl);
  const displayName = settings.rtl ? category.nameAr || category.nameEn : category.nameEn || category.nameAr;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${displayName} ${copy.coursesCount}`,
    description: `${copy.publishedCourses} ${displayName}.`,
    url: absoluteUrl(`/categories/${category.slug}`, appUrl),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: category.courses.map((course, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: course.title,
        url: absoluteUrl(`/courses/${course.slug}`, appUrl),
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <span className="moe-mini-icon h-12 w-12">
            <FolderOpen size={23} />
          </span>
          <h1 className="mt-5 text-5xl font-black text-white">{displayName}</h1>
          {!settings.rtl && category.nameAr && <p className="mt-3 text-lg text-slate-300">{category.nameAr}</p>}
          <p className="mt-4 inline-flex rounded-lg border border-violet-300/20 bg-white/5 px-3 py-2 text-sm font-bold text-slate-300">{category.courses.length} {copy.publishedCourses}</p>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {category.courses.length ? category.courses.map((course) => (
            <CourseCard key={course.id} course={course} locale={settings.defaultLanguage} />
          )) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title={copy.noCategoryCoursesTitle} description={copy.noCategoryCoursesBody} />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
