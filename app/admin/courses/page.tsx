import { BookOpen, CheckCircle2, Clock3, DollarSign } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { fromJsonArray } from '@/lib/json-fields';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

function statusTone(status: string) {
  if (status === 'PUBLISHED') return 'green';
  if (status === 'PENDING') return 'yellow';
  if (status === 'REJECTED') return 'red';
  return 'slate';
}

function listText(value: string) {
  return fromJsonArray<string>(value).join('\n');
}

export default async function AdminCourses() {
  await requireUser(['ADMIN']);
  const [courses, categories, instructors, settings, orderedCourseRefs] = await Promise.all([
    prisma.course.findMany({
      include: {
        instructor: true,
        category: true,
        _count: { select: { enrollments: true, modules: true, liveSessions: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.category.findMany({ orderBy: { nameEn: 'asc' } }),
    prisma.user.findMany({ where: { role: { in: ['INSTRUCTOR', 'ADMIN'] }, status: { not: 'SUSPENDED' } }, orderBy: { name: 'asc' } }),
    getSiteSettings(),
    prisma.orderItem.findMany({ select: { courseId: true } })
  ]);

  const courseIdsWithOrders = new Set(orderedCourseRefs.map((item) => item.courseId));
  const published = courses.filter((course) => course.status === 'PUBLISHED').length;
  const pending = courses.filter((course) => course.status === 'PENDING').length;
  const revenueCatalogValue = courses.reduce((sum, course) => sum + Number(course.salePrice ?? course.price), 0);
  const coursesNeedingContent = courses.filter((course) => course._count.modules === 0 || !course.coverImage).length;

  return (
    <DashboardShell role="admin" title="Courses">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total courses" value={courses.length} icon={<BookOpen size={18} />} />
        <StatCard label="Published" value={published} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Pending review" value={pending} icon={<Clock3 size={18} />} />
        <StatCard label="Catalog value" value={formatMoney(revenueCatalogValue, settings.currency)} icon={<DollarSign size={18} />} />
      </div>

      <div className="mt-6 grid gap-4 2xl:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">Course Review Queue</h2>
              <p className="mt-1 text-sm font-semibold text-[#71767B]">Review content depth, pricing, certificate coverage and publishing status from one place.</p>
            </div>
          </div>
          <DataTable
            headers={['Course', 'Owner', 'Price', 'Signals', 'Admin Control']}
            rows={courses.map((course) => [
              <div key="course" className="min-w-[220px]">
                <p className="font-bold text-white">{course.title}</p>
                <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#71767B]">{course.shortDescription}</p>
              </div>,
              <div key="owner" className="grid gap-1 text-sm">
                <span>{course.instructor.name}</span>
                <span className="text-xs font-semibold text-[#71767B]">{course.category.nameEn}</span>
              </div>,
              formatMoney(course.salePrice ?? course.price, settings.currency),
              <div key="signals" className="grid gap-2 text-xs font-semibold text-[#71767B]">
                <Badge tone={statusTone(course.status)}>{course.status}</Badge>
                <span>{course._count.modules} modules</span>
                <span>{course._count.liveSessions} live sessions</span>
                <span>{course._count.enrollments} enrollments</span>
              </div>,
              <div key="actions" className="grid min-w-[420px] gap-3">
                <form className="grid gap-2" action="/api/admin/courses" method="post">
                  <CsrfInput />
                  <input type="hidden" name="_action" value="update" />
                  <input type="hidden" name="id" value={course.id} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="input" name="title" defaultValue={course.title} placeholder="Course title" />
                    <input className="input" name="slug" defaultValue={course.slug} placeholder="course-slug" />
                    <select className="input" name="instructorId" defaultValue={course.instructorId}>
                      {instructors.map((instructor) => (
                        <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                      ))}
                    </select>
                    <select className="input" name="categoryId" defaultValue={course.categoryId}>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.nameEn}</option>
                      ))}
                    </select>
                    <input className="input" name="price" type="number" min="0" step="0.01" defaultValue={String(course.price)} placeholder="Price" />
                    <input className="input" name="salePrice" type="number" min="0" step="0.01" defaultValue={course.salePrice ? String(course.salePrice) : ''} placeholder="Sale price" />
                    <select className="input" name="status" defaultValue={course.status}>
                      <option value="DRAFT">Draft</option>
                      <option value="PENDING">Pending review</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                    <select className="input" name="level" defaultValue={course.level}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <input className="input" name="language" defaultValue={course.language} placeholder="en" />
                    <input className="input" name="durationMinutes" type="number" min="0" defaultValue={course.durationMinutes} placeholder="Duration minutes" />
                  </div>
                  <textarea className="input min-h-20" name="shortDescription" defaultValue={course.shortDescription} placeholder="Short description" />
                  <textarea className="input min-h-24" name="fullDescription" defaultValue={course.fullDescription} placeholder="Full description" />
                  <input className="input" name="coverImage" defaultValue={course.coverImage || ''} placeholder="Cover image URL or /uploads/file.jpg" />
                  <input className="input" name="promoVideo" defaultValue={course.promoVideo || ''} placeholder="Promo video URL" />
                  <div className="grid gap-2 md:grid-cols-3">
                    <textarea className="input min-h-20" name="outcomes" defaultValue={listText(course.outcomes)} placeholder="Learning outcomes, one per line" />
                    <textarea className="input min-h-20" name="requirements" defaultValue={listText(course.requirements)} placeholder="Requirements, one per line" />
                    <textarea className="input min-h-20" name="targetAudience" defaultValue={listText(course.targetAudience)} placeholder="Target audience, one per line" />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#E7E9EA]">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="isFree" defaultChecked={course.isFree} /> Free course
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="includesCertificate" defaultChecked={course.includesCertificate} /> Includes certificate
                    </label>
                  </div>
                  <button className="btn-secondary w-fit">Save Course</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <form action="/api/admin/courses/publish" method="post">
                    <CsrfInput />
                    <input type="hidden" name="id" value={course.id} />
                    <button className="btn-primary">Publish</button>
                  </form>
                  <form className="flex flex-wrap gap-2" action="/api/admin/courses/reject" method="post">
                    <CsrfInput />
                    <input type="hidden" name="id" value={course.id} />
                    <input className="input h-10 min-w-48" name="reason" placeholder="Rejection reason" />
                    <button className="btn border">Reject</button>
                  </form>
                  <form action="/api/admin/courses" method="post">
                    <CsrfInput />
                    <input type="hidden" name="_action" value="delete" />
                    <input type="hidden" name="id" value={course.id} />
                    <button
                      className="btn-secondary border-red-400/40 text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={course._count.enrollments > 0 || courseIdsWithOrders.has(course.id)}
                      title={course._count.enrollments > 0
                        ? 'Courses with enrollments are preserved for student records.'
                        : courseIdsWithOrders.has(course.id)
                          ? 'Courses linked to order history are preserved for invoices, refunds and revenue reports.'
                          : 'Delete this empty course and its attached draft content.'}
                    >
                      Delete empty course
                    </button>
                  </form>
                </div>
              </div>
            ])}
          />
        </section>

        <aside className="border border-[#2F3336] bg-black p-5">
          <h2 className="text-lg font-black text-white">Reviewer QA Signals</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between border-b border-[#2F3336] pb-3">
              <span className="font-semibold text-[#71767B]">Needs cover/modules</span>
              <Badge tone={coursesNeedingContent ? 'yellow' : 'green'}>{coursesNeedingContent}</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-[#2F3336] pb-3">
              <span className="font-semibold text-[#71767B]">Certificate enabled</span>
              <Badge tone="blue">{courses.filter((course) => course.includesCertificate).length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#71767B]">Free courses</span>
              <Badge tone="slate">{courses.filter((course) => course.isFree).length}</Badge>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-[#71767B]">
            Keep at least one polished published course with modules, a cover image, checkout pricing and student progress data for marketplace review.
          </p>
        </aside>

        <aside className="border border-[#2F3336] bg-black p-5 2xl:col-start-2">
          <h2 className="text-lg font-black text-white">Create Course As Admin</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Create a course owned by any instructor. Lessons and modules can still be added from the instructor course builder.</p>
          <form className="mt-5 grid gap-3" action="/api/admin/courses" method="post">
            <CsrfInput />
            <input type="hidden" name="_action" value="create" />
            <input className="input" name="title" placeholder="Course title" required />
            <input className="input" name="slug" placeholder="course-slug, optional" />
            <textarea className="input min-h-24" name="shortDescription" placeholder="Short description" required />
            <textarea className="input min-h-28" name="fullDescription" placeholder="Full course description" />
            <select className="input" name="instructorId" required>
              <option value="">Select instructor</option>
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
              ))}
            </select>
            <select className="input" name="categoryId" required>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.nameEn}</option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="input" name="price" type="number" min="0" step="0.01" placeholder="Price" defaultValue="0" />
              <input className="input" name="salePrice" type="number" min="0" step="0.01" placeholder="Sale price" />
              <select className="input" name="status" defaultValue="PENDING">
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending review</option>
                <option value="PUBLISHED">Published</option>
              </select>
              <select className="input" name="level" defaultValue="beginner">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <input className="input" name="language" defaultValue="en" placeholder="Language code" />
            <input className="input" name="durationMinutes" type="number" min="0" placeholder="Duration minutes" />
            <input className="input" name="coverImage" placeholder="Cover image URL or /uploads/file.jpg" />
            <input className="input" name="promoVideo" placeholder="Promo video URL" />
            <textarea className="input min-h-20" name="outcomes" placeholder="Learning outcomes, one per line" />
            <textarea className="input min-h-20" name="requirements" placeholder="Requirements, one per line" />
            <textarea className="input min-h-20" name="targetAudience" placeholder="Target audience, one per line" />
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#E7E9EA]">
              <label className="flex items-center gap-2"><input type="checkbox" name="isFree" /> Free course</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="includesCertificate" defaultChecked /> Includes certificate</label>
            </div>
            <button className="btn-primary w-fit">Create Course</button>
          </form>
        </aside>
      </div>
    </DashboardShell>
  );
}
