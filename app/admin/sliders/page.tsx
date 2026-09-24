import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Sliders() {
  await requireUser(['ADMIN']);
  const sliders = await prisma.slider.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <DashboardShell role="admin" title="Home Slider">
      <form className="card mb-6 grid gap-3 md:grid-cols-2" action="/api/admin/sliders" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Title" required />
        <input className="input" name="subtitle" placeholder="Subtitle" />
        <input className="input" name="image" placeholder="Image URL or /path" />
        <input className="input" name="buttonText" placeholder="Button text" />
        <input className="input" name="buttonUrl" placeholder="Button URL or /path" />
        <input className="input" name="sortOrder" type="number" placeholder="Sort" />
        <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Add Slide</button>
      </form>

      <DataTable
        headers={['Title', 'Media', 'Button', 'Sort', 'Status', 'Manage']}
        rows={sliders.map((slide) => [
          <div key="title" className="min-w-56">
            <p className="font-black text-white">{slide.title}</p>
            <p className="mt-1 text-xs text-[#71767B]">{slide.subtitle || 'No subtitle'}</p>
          </div>,
          <span key="media" className="max-w-xs break-all text-xs text-[#71767B]">{slide.image || '-'}</span>,
          <span key="button" className="text-sm text-[#E7E9EA]">{slide.buttonText || '-'} {slide.buttonUrl ? `-> ${slide.buttonUrl}` : ''}</span>,
          slide.sortOrder,
          <Badge key="status" tone={slide.active ? 'green' : 'red'}>{slide.active ? 'Active' : 'Disabled'}</Badge>,
          <div key="manage" className="grid min-w-72 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/sliders" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={slide.id} />
                <input type="hidden" name="action" value="update" />
                <input className="input" name="title" defaultValue={slide.title} required />
                <input className="input" name="subtitle" defaultValue={slide.subtitle || ''} />
                <input className="input" name="image" defaultValue={slide.image || ''} />
                <input className="input" name="buttonText" defaultValue={slide.buttonText || ''} />
                <input className="input" name="buttonUrl" defaultValue={slide.buttonUrl || ''} />
                <input className="input" name="sortOrder" type="number" defaultValue={slide.sortOrder} />
                <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked={slide.active} /> Active</label>
                <button className="btn-primary w-fit">Save</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/sliders" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={slide.id} />
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="active" value={slide.active ? 'false' : 'true'} />
                <button className="btn-secondary">{slide.active ? 'Disable' : 'Activate'}</button>
              </form>
              <form action="/api/admin/sliders" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={slide.id} />
                <input type="hidden" name="action" value="delete" />
                <button className="btn-secondary">Delete</button>
              </form>
            </div>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
