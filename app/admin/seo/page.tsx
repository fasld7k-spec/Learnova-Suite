import { CheckCircle2, Globe2, Search } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { getSeoSettings } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

export default async function SeoSettings(props: { searchParams?: Promise<{ saved?: string }> }) {
  await requireUser(['ADMIN']);
  const [searchParams, settings] = await Promise.all([props.searchParams, getSiteSettings()]);
  const seo = await getSeoSettings({ siteName: settings.siteName, tagline: settings.tagline });

  return (
    <DashboardShell role="admin" title="SEO Settings">
      {searchParams?.saved && (
        <div className="mb-6 flex items-start gap-3 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm text-[#D7FBE8]">
          <CheckCircle2 className="mt-0.5 text-[#5EE4B3]" size={20} />
          <p className="font-bold">SEO settings saved and now power the global site metadata.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <Search className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-sm font-bold text-[#71767B]">Default title</p>
          <p className="mt-2 text-xl font-black text-white">{seo.defaultTitle}</p>
        </div>
        <div className="card">
          <Globe2 className="text-[#1D9BF0]" size={22} />
          <p className="mt-4 text-sm font-bold text-[#71767B]">Robots</p>
          <p className="mt-2 text-xl font-black text-white">{seo.robotsIndex ? 'Index' : 'No index'} / {seo.robotsFollow ? 'Follow' : 'No follow'}</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-[#71767B]">Open Graph</p>
          <p className="mt-2 break-all text-sm leading-6 text-white">{seo.ogImage || 'No default image configured'}</p>
        </div>
      </div>

      <form className="card mt-6 grid max-w-4xl gap-4" action="/api/admin/seo" method="post">
          <CsrfInput />
        <label className="text-sm font-bold text-[#E7E9EA]">
          Default SEO title
          <input className="input mt-2" name="defaultTitle" defaultValue={seo.defaultTitle} required />
        </label>
        <label className="text-sm font-bold text-[#E7E9EA]">
          Default meta description
          <textarea className="input mt-2 min-h-28" name="defaultDescription" defaultValue={seo.defaultDescription} required />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold text-[#E7E9EA]">
            Default OpenGraph image
            <input className="input mt-2" name="ogImage" placeholder="/uploads/seo-cover.webp or https://cdn.example.com/og.webp" defaultValue={seo.ogImage} />
          </label>
          <label className="text-sm font-bold text-[#E7E9EA]">
            X / Twitter handle
            <input className="input mt-2" name="twitterHandle" placeholder="yourbrand" defaultValue={seo.twitterHandle} />
          </label>
        </div>
        <label className="text-sm font-bold text-[#E7E9EA]">
          Keywords
          <input className="input mt-2" name="keywords" placeholder="online courses, LMS, marketplace" defaultValue={seo.keywords.join(', ')} />
        </label>
        <div className="flex flex-wrap gap-4 text-sm font-bold text-[#E7E9EA]">
          <label className="flex items-center gap-2">
            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="robotsIndex" defaultChecked={seo.robotsIndex} /> Allow indexing
          </label>
          <label className="flex items-center gap-2">
            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="robotsFollow" defaultChecked={seo.robotsFollow} /> Allow following links
          </label>
        </div>
        <button className="btn-primary w-fit">Save SEO</button>
      </form>
    </DashboardShell>
  );
}
