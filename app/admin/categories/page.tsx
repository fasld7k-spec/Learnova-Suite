import { BookOpenCheck, FolderTree, Globe2, ShieldCheck } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/site-settings';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

function money(value: unknown) {
  return Number(value || 0);
}

export default async function Categories() {
  await requireUser(['ADMIN']);
  const categories = await prisma.category.findMany({
    include: {
      courses: {
        select: {
          id: true,
          price: true,
          salePrice: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const totalCourses = categories.reduce((sum, category) => sum + category.courses.length, 0);
  const publishedCourses = categories.reduce((sum, category) => sum + category.courses.filter((course) => course.status === 'PUBLISHED').length, 0);
  const emptyCategories = categories.filter((category) => category.courses.length === 0).length;
  const catalogValue = categories.reduce(
    (sum, category) => sum + category.courses.reduce((courseSum, course) => courseSum + money(course.salePrice ?? course.price), 0),
    0
  );

  const sortedCategories = [...categories].sort((a, b) => b.courses.length - a.courses.length || a.nameEn.localeCompare(b.nameEn));

  return (
    <DashboardShell role="admin" title="Categories">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Categories" value={categories.length} icon={<FolderTree size={18} />} />
        <StatCard label="Assigned courses" value={totalCourses} icon={<BookOpenCheck size={18} />} />
        <StatCard label="Published courses" value={publishedCourses} icon={<ShieldCheck size={18} />} />
        <StatCard label="Catalog value" value={formatMoney(catalogValue)} icon={<Globe2 size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/categories" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Catalog taxonomy</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a marketplace category</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Categories power public discovery, localized navigation, course filters and reporting. Keep slugs stable after courses are assigned.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="nameEn" placeholder="English name" required />
            <input className="input" name="nameAr" placeholder="Arabic name" required />
            <input className="input" name="slug" placeholder="slug" required />
          </div>
          <button className="btn-primary mt-4">Add Category</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Review signals</p>
          <h3 className="mt-1 text-xl font-black text-white">Taxonomy health</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Empty categories</span>
              <Badge tone={emptyCategories ? 'yellow' : 'green'}>{emptyCategories}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Published coverage</span>
              <Badge tone={publishedCourses ? 'green' : 'yellow'}>{publishedCourses ? 'Ready' : 'Needs courses'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>RTL labels</span>
              <Badge tone={categories.every((category) => category.nameAr) ? 'green' : 'yellow'}>Tracked</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Category', 'Arabic label', 'Slug', 'Courses', 'Published', 'Status', 'Manage']}
          rows={sortedCategories.map((category) => {
            const published = category.courses.filter((course) => course.status === 'PUBLISHED').length;
            return [
              <div key="category">
                <p className="font-bold text-white">{category.nameEn}</p>
                <p className="mt-1 text-xs text-[#71767B]">Created {category.createdAt.toLocaleDateString()}</p>
              </div>,
              category.nameAr,
              <code key="slug" className="text-xs text-[#1D9BF0]">{category.slug}</code>,
              category.courses.length,
              published,
              <Badge key="status" tone={category.courses.length ? 'green' : 'yellow'}>
                {category.courses.length ? 'In use' : 'Empty'}
              </Badge>,
              <div key="manage" className="grid min-w-80 gap-2">
                <form className="grid gap-2" action="/api/admin/categories" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="update" />
                  <input type="hidden" name="id" value={category.id} />
                  <input className="input" name="nameEn" defaultValue={category.nameEn} />
                  <input className="input" name="nameAr" defaultValue={category.nameAr} />
                  <input className="input" name="slug" defaultValue={category.slug} />
                  <button className="btn-secondary w-fit">Update</button>
                </form>
                <form action="/api/admin/categories" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={category.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200" disabled={category.courses.length > 0}>
                    {category.courses.length ? 'Move courses before delete' : 'Delete'}
                  </button>
                </form>
              </div>
            ];
          })}
        />
      </section>
    </DashboardShell>
  );
}
