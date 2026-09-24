import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const defaultTemplate = `<div style="border:1px solid #2F3336;padding:18px">
  <h2>Invoice {{invoiceNumber}}</h2>
  <p>Status: {{status}}</p>
  <p>Total: {{total}} {{currency}}</p>
  <p>Issued: {{createdAt}}</p>
</div>`;

export default async function InvoiceTemplates(props: { searchParams?: Promise<{ saved?: string; deleted?: string }> }) {
  await requireUser(['ADMIN']);
  const [templates, searchParams] = await Promise.all([
    prisma.invoiceTemplate.findMany({ orderBy: { createdAt: 'desc' } }),
    props.searchParams,
  ]);

  return (
    <DashboardShell role="admin" title="Invoice Templates">
      {searchParams?.saved ? <p className="mb-4 border border-[#00BA7C]/40 bg-[#00BA7C]/10 p-3 text-sm font-bold text-[#D7FBE8]">Invoice template saved.</p> : null}
      {searchParams?.deleted ? <p className="mb-4 border border-[#00BA7C]/40 bg-[#00BA7C]/10 p-3 text-sm font-bold text-[#D7FBE8]">Invoice template deleted.</p> : null}
      <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/invoice-templates" method="post">
        <CsrfInput />
        <h2 className="text-xl font-black text-white">Create invoice template</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">Available variables: invoiceNumber, status, total, currency, gateway, createdAt.</p>
        <div className="mt-4 grid gap-3">
          <input className="input" name="name" placeholder="Default invoice template" required />
          <textarea className="input min-h-48 font-mono text-xs" name="html" defaultValue={defaultTemplate} required />
          <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked />
            Active template
          </label>
          <button className="btn-primary w-fit">Save template</button>
        </div>
      </form>

      <div className="mt-6">
        <DataTable
          headers={['Name', 'Status', 'Created', 'Actions']}
          rows={templates.map((template) => [
            template.name,
            <Badge key="active" tone={template.active ? 'green' : 'slate'}>{template.active ? 'Active' : 'Inactive'}</Badge>,
            template.createdAt.toLocaleDateString(),
            <div key="actions" className="flex flex-wrap gap-2">
              <details>
                <summary className="btn-secondary cursor-pointer text-xs">Edit</summary>
                <form className="mt-3 grid min-w-80 gap-3 border border-[#2F3336] bg-black p-3" action="/api/admin/invoice-templates" method="post">
                  <CsrfInput />
                  <input type="hidden" name="id" value={template.id} />
                  <input className="input" name="name" defaultValue={template.name} required />
                  <textarea className="input min-h-40 font-mono text-xs" name="html" defaultValue={template.html} required />
                  <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                    <input type="checkbox" name="active" defaultChecked={template.active} />
                    Active
                  </label>
                  <button className="btn-primary text-xs">Save</button>
                </form>
              </details>
              <form action="/api/admin/invoice-templates" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="id" value={template.id} />
                <button className="btn-secondary text-xs">Delete</button>
              </form>
            </div>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
