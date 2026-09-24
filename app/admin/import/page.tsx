import { FileSpreadsheet, Tags } from 'lucide-react';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

type ImportCenterProps = {
  searchParams?: {
    categoriesImported?: string;
    couponsImported?: string;
    skipped?: string;
  };
};

function resultMessage(searchParams?: ImportCenterProps['searchParams']) {
  if (searchParams?.categoriesImported) {
    return `${searchParams.categoriesImported} categories imported${searchParams.skipped ? `, ${searchParams.skipped} skipped` : ''}.`;
  }
  if (searchParams?.couponsImported) {
    return `${searchParams.couponsImported} coupons imported${searchParams.skipped ? `, ${searchParams.skipped} skipped` : ''}.`;
  }
  return '';
}

export default async function ImportCenter({ searchParams }: ImportCenterProps) {
  await requireUser(['ADMIN']);
  const message = resultMessage(searchParams);
  const [categories, coupons, recentCategories, recentCoupons] = await Promise.all([
    prisma.category.count(),
    prisma.coupon.count(),
    prisma.category.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);

  return (
    <DashboardShell role="admin" title="Import Center">
      {message && <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{message}</div>}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#71767B]">Catalog categories</p>
              <p className="mt-1 text-3xl font-black text-white">{categories}</p>
            </div>
            <a className="btn-secondary" href="/admin/categories">Manage</a>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {recentCategories.map((category) => <Badge key={category.id} tone="slate">{category.nameEn}</Badge>)}
            {!recentCategories.length && <span className="text-sm text-[#71767B]">No categories yet.</span>}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#71767B]">Coupon codes</p>
              <p className="mt-1 text-3xl font-black text-white">{coupons}</p>
            </div>
            <a className="btn-secondary" href="/admin/coupons">Manage</a>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {recentCoupons.map((coupon) => <Badge key={coupon.id} tone={coupon.active ? 'green' : 'red'}>{coupon.code}</Badge>)}
            {!recentCoupons.length && <span className="text-sm text-[#71767B]">No coupons yet.</span>}
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <form className="card" action="/api/admin/import/categories" method="post" encType="multipart/form-data">
          <CsrfInput />
          <FileSpreadsheet className="text-[#1D9BF0]" size={22} />
          <h2 className="mt-4 text-xl font-black text-white">Import Categories CSV</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Columns: nameEn,nameAr,slug. Header row is optional.</p>
          <label className="mt-4 block text-sm font-bold text-[#E7E9EA]">
            Upload CSV file
            <input className="input mt-2" type="file" name="file" accept=".csv,text/csv,text/plain" />
          </label>
          <textarea className="input mt-4 min-h-40" name="csv" placeholder="Web Development,تطوير الويب,web-development" />
          <button className="btn-primary mt-4">Import Categories</button>
        </form>

        <form className="card" action="/api/admin/import/coupons" method="post" encType="multipart/form-data">
          <CsrfInput />
          <Tags className="text-[#1D9BF0]" size={22} />
          <h2 className="mt-4 text-xl font-black text-white">Import Coupons CSV</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Columns: code,discountType,percent,amount,startsAt,expiresAt,maxUses,perUserLimit,minOrderAmount,active.
          </p>
          <label className="mt-4 block text-sm font-bold text-[#E7E9EA]">
            Upload CSV file
            <input className="input mt-2" type="file" name="file" accept=".csv,text/csv,text/plain" />
          </label>
          <textarea className="input mt-4 min-h-40" name="csv" placeholder="SUMMER20,PERCENT,20,0,2026-06-01,2026-06-30,500,1,0,true" />
          <button className="btn-primary mt-4">Import Coupons</button>
        </form>
      </div>
    </DashboardShell>
  );
}

