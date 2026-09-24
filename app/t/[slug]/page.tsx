import { Building2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { CourseCard } from '@/components/CourseCard';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function TenantPortal(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: params.slug } });
  if (!tenant || !tenant.active) notFound();
  const memberCount = await prisma.tenantMember.count({ where: { tenantId: tenant.id } });
  if (memberCount > 0) {
    const session = await getSession();
    if (!session) redirect(`/login?next=/t/${encodeURIComponent(tenant.slug)}`);
    if (session.role !== 'ADMIN') {
      const member = await prisma.tenantMember.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: session.id } }, select: { id: true } });
      if (!member) notFound();
    }
  }

  const mappings = await prisma.tenantCourse.findMany({ where: { tenantId: tenant.id } });
  const courses = mappings.length
    ? await prisma.course.findMany({
        where: { id: { in: mappings.map((mapping) => mapping.courseId) }, status: 'PUBLISHED' },
        include: { category: true, instructor: true }
      })
    : await prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        take: 6,
        include: { category: true, instructor: true },
        orderBy: { createdAt: 'desc' }
      });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <Building2 size={23} />
            </span>
            <h1 className="mt-5 text-5xl font-black text-white">{tenant.name}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Private learning portal with curated courses, team-ready training, and branded marketplace access.
            </p>
          </div>
        </section>
        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => <CourseCard key={course.id} course={course} />)}
        </section>
      </main>
      <Footer />
    </>
  );
}
