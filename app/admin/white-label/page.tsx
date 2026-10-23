import Image from 'next/image';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

export default async function WhiteLabel({ searchParams }: { searchParams?: { saved?: string } }) {
  await requireUser(['ADMIN']);
  const [row, effective] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'white_label' } }),
    getSiteSettings(),
  ]);
  const value = fromJsonObject<any>(row?.value);
  const brandName = value.brandName || effective.siteName;
  const logoUrl = value.logoUrl || effective.logoUrl;
  const faviconUrl = value.faviconUrl || effective.faviconUrl;
  const supportEmail = value.supportEmail || effective.supportEmail;

  return (
    <DashboardShell role="admin" title="White Label">
      {searchParams?.saved && <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">White-label settings saved and cache refreshed.</div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form className="card grid gap-4" action="/api/admin/white-label" method="post">
          <CsrfInput />
          <div>
            <h2 className="text-xl font-black text-white">Branding</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              These values override the public brand name, logo, favicon, support contact, and marketplace footer without editing code.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold text-[#E7E9EA]">
              Brand name
              <input className="input mt-2" name="brandName" placeholder="Learnova Suite" defaultValue={brandName} required />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Support email
              <input className="input mt-2" name="supportEmail" type="email" placeholder="support@your-domain.com" defaultValue={supportEmail} required />
            </label>
          </div>
          <label className="text-sm font-bold text-[#E7E9EA]">
            Logo URL
            <input className="input mt-2" name="logoUrl" placeholder="/uploads/logo.svg or https://cdn.example.com/logo.svg" defaultValue={logoUrl} />
          </label>
          <label className="text-sm font-bold text-[#E7E9EA]">
            Favicon URL
            <input className="input mt-2" name="faviconUrl" placeholder="/icon.svg or https://cdn.example.com/favicon.svg" defaultValue={faviconUrl} />
          </label>
          <label className="text-sm font-bold text-[#E7E9EA]">
            Footer note
            <textarea className="input mt-2 min-h-24" name="footerNote" placeholder="Optional support or copyright note shown in admin records." defaultValue={value.footerNote || ''} />
          </label>
          <button className="btn-primary w-fit">Save White Label</button>
        </form>

        <aside className="card">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71767B]">Live preview</p>
          <div className="mt-4 rounded-3xl border border-[#2F3336] bg-black p-5">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-[#2F3336] bg-[#16181C]">
                {logoUrl ? <Image src={logoUrl} alt="" fill sizes="48px" className="object-contain p-2" unoptimized /> : null}
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{brandName}</h3>
                <p className="text-sm text-[#71767B]">{supportEmail}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-[#2F3336] bg-[#16181C] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#71767B]">Favicon</p>
              <p className="mt-2 break-all text-sm text-[#E7E9EA]">{faviconUrl || '/icon.svg'}</p>
            </div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
