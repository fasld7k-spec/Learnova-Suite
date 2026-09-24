import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';

export default async function GlobalThemeTokensPage() {
  await requireUser(['ADMIN']);
  const s = await prisma.setting.findUnique({ where: { key: 'theme' } });
  const v = fromJsonObject<any>(s?.value);

  return (
    <DashboardShell role="admin" title="Global Theme Tokens">
      <form className="grid max-w-4xl gap-6" action="/api/admin/theme" method="post">
          <CsrfInput />
        <input type="hidden" name="globalOnly" value="1" />
        <section className="card grid gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <Link className="text-sm font-bold text-[#1D9BF0]" href="/admin/theme">Back to themes</Link>
              <h2 className="mt-3 text-xl font-black text-white">Shared visual tokens</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#71767B]">These values apply across the selected homepage theme and shared platform UI. Theme-specific pages can still override homepage visuals.</p>
            </div>
            <Link className="btn-secondary min-h-9 px-4" href="/" target="_blank">
              Preview site
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-bold text-[#E7E9EA]">
              Primary color
              <input className="input mt-2" name="primary" defaultValue={v.primary || '#1D9BF0'} placeholder="#1D9BF0" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Primary hover color
              <input className="input mt-2" name="brandStrong" defaultValue={v.brandStrong || '#1A8CD8'} placeholder="#1A8CD8" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Brand soft color
              <input className="input mt-2" name="brandSoft" defaultValue={v.brandSoft || 'rgba(29, 155, 240, 0.14)'} placeholder="rgba(29, 155, 240, 0.14)" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Secondary surface color
              <input className="input mt-2" name="secondary" defaultValue={v.secondary || '#16181C'} placeholder="#16181C" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Background color
              <input className="input mt-2" name="background" defaultValue={v.background || '#000000'} placeholder="#000000" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Text color
              <input className="input mt-2" name="foreground" defaultValue={v.foreground || '#FFFFFF'} placeholder="#FFFFFF" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Muted text color
              <input className="input mt-2" name="muted" defaultValue={v.muted || '#71767B'} placeholder="#71767B" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Border color
              <input className="input mt-2" name="border" defaultValue={v.border || '#2F3336'} placeholder="#2F3336" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Base panel color
              <input className="input mt-2" name="panel" defaultValue={v.panel || '#000000'} placeholder="#000000" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Strong panel color
              <input className="input mt-2" name="panelStrong" defaultValue={v.panelStrong || '#16181C'} placeholder="#16181C" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Button text color
              <input className="input mt-2" name="buttonText" defaultValue={v.buttonText || '#FFFFFF'} placeholder="#FFFFFF" />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA]">
              Radius
              <input className="input mt-2" name="radius" defaultValue={v.radius || '9999px'} />
            </label>
            <label className="text-sm font-bold text-[#E7E9EA] md:col-span-2">
              Font family
              <input className="input mt-2" name="font" defaultValue={v.font || 'Chirp, Inter, system-ui'} />
            </label>
          </div>
        </section>
        <div className="sticky bottom-4 flex justify-end border border-[#2F3336] bg-black/95 p-4">
          <button className="btn-primary">Save Global Tokens</button>
        </div>
      </form>
    </DashboardShell>
  );
}
