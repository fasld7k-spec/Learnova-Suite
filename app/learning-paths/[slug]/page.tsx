import { ArrowRight, Route } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { CourseCard } from '@/components/CourseCard';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { notFound } from 'next/navigation';
import { fromJsonArray } from '@/lib/json-fields';

export default async function LearningPathDetail(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const path = await prisma.learningPath.findUnique({ where: { slug: params.slug } });
  if (!path || !path.active) notFound();
  const courseIds = fromJsonArray<string>(path.courseIds);
  const courses = await prisma.course.findMany({ where: { id: { in: courseIds }, status: 'PUBLISHED' }, include: { category: true, instructor: true } });
  const courseOrder = new Map(courseIds.map((id, index) => [id, index]));
  courses.sort((a, b) => (courseOrder.get(a.id) ?? 0) - (courseOrder.get(b.id) ?? 0));

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <div>
            <span className="moe-mini-icon h-12 w-12">
              <Route size={23} />
            </span>
            <h1 className="mt-5 text-5xl font-black text-white">{path.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{path.description}</p>
          </div>
          <form className="moe-panel h-fit p-5" action="/api/learning-paths/enroll" method="post">
            <CsrfInput />
            <input type="hidden" name="learningPathId" value={path.id} />
            <p className="text-sm font-bold text-slate-400">Path includes</p>
            <b className="mt-2 block text-4xl font-black">{courses.length}</b>
            <p className="mt-1 text-sm text-slate-300">published courses</p>
            <button className="moe-primary mt-5 w-full justify-center px-5 py-3">
              Enroll in Path
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.length ? courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          )) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No published courses" description="Courses will appear here when this path is connected to published catalog items." />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
