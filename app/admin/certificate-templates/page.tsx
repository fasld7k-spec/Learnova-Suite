import { Badge } from '@/components/dashboard/Badge';
import { CertificateTemplateEditor, CertificateTemplatePreview } from '@/components/certificates/CertificateTemplateEditor';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { certificateTemplateVariables, defaultCertificateTemplateHtml } from '@/lib/certificates';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function CertificateTemplates() {
  await requireUser(['ADMIN']);
  const rows = await prisma.certificateTemplate.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="admin" title="Certificate Templates">
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
        <form className="card grid gap-4" action="/api/admin/certificate-templates" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="create" />
          <div>
            <p className="eyebrow">Default credential design</p>
            <h2 className="mt-2 text-2xl font-black text-white">Create certificate template</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">
              The active template is used on public certificate pages and printable certificate pages.
            </p>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#E7E9EA]">Template name</span>
            <input className="input" name="name" placeholder="Modern completion certificate" required />
          </label>
          <CertificateTemplateEditor defaultHtml={defaultCertificateTemplateHtml} />
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked />
            Make this the active template
          </label>
          <button className="btn-primary w-fit">Save Template</button>
        </form>

        <aside className="card h-fit">
          <p className="eyebrow">Template variables</p>
          <h3 className="mt-2 text-xl font-black text-white">Available placeholders</h3>
          <div className="mt-4 grid gap-2">
            {certificateTemplateVariables.map((variable) => (
              <code key={variable} className="rounded-full border border-[#2F3336] px-3 py-2 text-sm text-[#E7E9EA]">
                {'{{'}
                {variable}
                {'}}'}
              </code>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[#71767B]">
            Static HTML and inline styles are supported. Script tags, event handlers, iframes, and javascript URLs are rejected.
          </p>
        </aside>
      </div>

      <DataTable
        headers={['Template', 'Status', 'Created', 'Preview', 'Edit HTML', 'Actions']}
        rows={rows.map((template) => [
          <div key="name">
            <p className="font-black text-white">{template.name}</p>
            <p className="mt-1 text-xs text-[#71767B]">{template.id}</p>
          </div>,
          <Badge key="status" tone={template.active ? 'green' : 'slate'}>
            {template.active ? 'Active default' : 'Inactive'}
          </Badge>,
          template.createdAt.toLocaleDateString(),
          <div key="preview" className="min-w-[300px]">
            <CertificateTemplatePreview html={template.html} compact />
          </div>,
          <form key="edit" className="grid min-w-[360px] gap-3" action="/api/admin/certificate-templates" method="post">
          <CsrfInput />
            <input type="hidden" name="action" value="update" />
            <input type="hidden" name="id" value={template.id} />
            <input className="input" name="name" defaultValue={template.name} required />
            <CertificateTemplateEditor defaultHtml={template.html} compact />
            <label className="flex items-center gap-2 text-xs font-bold text-[#E7E9EA]">
              <input className="h-4 w-4 accent-[#1D9BF0]" type="checkbox" name="active" defaultChecked={template.active} />
              Set as active default
            </label>
            <button className="btn-secondary w-fit">Update</button>
          </form>,
          <div key="actions" className="flex flex-wrap gap-2">
            {!template.active ? (
              <form action="/api/admin/certificate-templates" method="post">
          <CsrfInput />
                <input type="hidden" name="action" value="activate" />
                <input type="hidden" name="id" value={template.id} />
                <button className="btn-primary whitespace-nowrap">Activate</button>
              </form>
            ) : null}
            <form action="/api/admin/certificate-templates" method="post">
          <CsrfInput />
              <input type="hidden" name="action" value="duplicate" />
              <input type="hidden" name="id" value={template.id} />
              <button className="btn-secondary whitespace-nowrap">Duplicate</button>
            </form>
            <form action="/api/admin/certificate-templates" method="post">
          <CsrfInput />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="id" value={template.id} />
              <button className="btn-secondary whitespace-nowrap border-[#F4212E] text-[#F4212E] hover:bg-[#1f0508] disabled:cursor-not-allowed disabled:opacity-50" disabled={template.active} title={template.active ? 'Activate another template before deleting this one.' : 'Delete inactive template'}>Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
