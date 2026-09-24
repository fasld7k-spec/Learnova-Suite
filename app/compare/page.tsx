export const dynamic = 'force-dynamic';

import { BarChart3 } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

export default async function Compare(props: { searchParams: Promise<{ ids?: string }> }) {
  const searchParams = await props.searchParams;
  const ids = (searchParams.ids || '').split(',').filter(Boolean).slice(0, 4);
  const [courses, settings] = await Promise.all([
    ids.length
      ? prisma.course.findMany({ where: { id: { in: ids }, status: 'PUBLISHED' }, include: { category: true, instructor: true, modules: { include: { lessons: true } }, reviews: true } })
      : prisma.course.findMany({ where: { status: 'PUBLISHED' }, take: 4, orderBy: { createdAt: 'desc' }, include: { category: true, instructor: true, modules: { include: { lessons: true } }, reviews: true } }),
    getSiteSettings()
  ]);
  const comparisonRows = courses.length
    ? courses.map((course) => ({
        id: course.id,
        title: course.title,
        price: formatMoney(course.salePrice ?? course.price, settings.currency),
        instructor: course.instructor.name,
        level: course.level,
        lessons: course.modules.reduce((sum, module) => sum + module.lessons.length, 0)
      }))
    : [];

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-6 md:p-8">
          <span className="moe-mini-icon h-12 w-12">
            <BarChart3 size={23} />
          </span>
          <h1 className="mt-5 text-5xl font-black text-white">Compare Courses</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Review pricing, instructor fit, level, and lesson depth across the most relevant courses.</p>
        </div>
        </section>

        <section className="page-shell mt-8">
          {comparisonRows.length ? (
          <div className="moe-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-white/[0.04] text-left">
                  <tr>{comparisonRows.map((course) => <th className="px-5 py-4 text-base font-black text-white" key={course.id}>{course.title}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-violet-300/15 text-slate-200">
                  <tr>{comparisonRows.map((course) => <td className="px-5 py-4 font-bold text-violet-100" key={course.id}>{course.price}</td>)}</tr>
                  <tr>{comparisonRows.map((course) => <td className="px-5 py-4" key={course.id}>{course.instructor}</td>)}</tr>
                  <tr>{comparisonRows.map((course) => <td className="px-5 py-4" key={course.id}>{course.level}</td>)}</tr>
                  <tr>{comparisonRows.map((course) => <td className="px-5 py-4" key={course.id}>{course.lessons} lessons</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <div className="moe-panel p-6 text-center">
              <span className="moe-mini-icon mx-auto">
                <BarChart3 size={22} />
              </span>
              <h2 className="mt-4 text-2xl font-black text-white">No courses available to compare yet</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                {ids.length ? 'The selected courses could not be found or are not available for comparison.' : 'Published courses will appear here once they are added to the catalog.'}
              </p>
              <a className="moe-primary mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-black text-white" href="/courses">
                Browse courses
              </a>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
