import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function LtiTools() {
  await requireUser(['ADMIN']);
  const rows = await prisma.ltiTool.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="admin" title="LTI External Tool Registry">
      <section className="card mb-6 border-amber-400/40 bg-amber-400/10">
        <p className="text-xs font-black uppercase text-amber-200">Registry scope</p>
        <h2 className="mt-2 text-lg font-black text-white">External tool launch registry, not a full LTI runtime</h2>
        <p className="mt-2 text-sm leading-6 text-[#E7E9EA]">
          Use this page to store tool names, client IDs, launch URLs, public keys, and active status for
          external tools. Full LTI 1.3 OIDC login initiation, deep linking, NRPS, AGS, JWT validation, and
          platform-grade launch session handling are not included.
        </p>
      </section>

      <form className="card mb-6 grid gap-3" action="/api/admin/lti-tools" method="post">
          <CsrfInput />
        <input className="input" name="name" placeholder="Tool name" required />
        <input className="input" name="clientId" placeholder="Client ID" required />
        <input className="input" name="launchUrl" placeholder="https://tool.example.com/launch" required />
        <textarea className="input min-h-28" name="publicKey" placeholder="Public key" />
        <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked /> Active</label>
        <button className="btn-primary w-fit">Save Registry Entry</button>
      </form>

      <DataTable
        headers={['Name', 'Client', 'Launch URL', 'Status', 'Manage']}
        rows={rows.map((tool) => [
          <span key="name" className="font-black text-white">{tool.name}</span>,
          <span key="client" className="font-mono text-xs text-[#71767B]">{tool.clientId}</span>,
          <a key="launch" className="max-w-xs break-all text-sm text-[#1D9BF0]" href={tool.launchUrl}>{tool.launchUrl}</a>,
          <Badge key="a" tone={tool.active ? 'green' : 'red'}>{tool.active ? 'Active' : 'Disabled'}</Badge>,
          <div key="manage" className="grid min-w-80 gap-3">
            <details>
              <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-2" action="/api/admin/lti-tools" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={tool.id} />
                <input className="input" name="name" defaultValue={tool.name} required />
                <input className="input" name="clientId" defaultValue={tool.clientId} required />
                <input className="input" name="launchUrl" defaultValue={tool.launchUrl} required />
                <textarea className="input min-h-24" name="publicKey" defaultValue={tool.publicKey || ''} />
                <label className="flex gap-2 text-sm font-bold text-[#E7E9EA]"><input type="checkbox" name="active" defaultChecked={tool.active} /> Active</label>
                <button className="btn-primary w-fit">Save</button>
              </form>
            </details>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/lti-tools" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={tool.id} />
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="active" value={tool.active ? 'false' : 'true'} />
                <button className="btn-secondary">{tool.active ? 'Disable' : 'Activate'}</button>
              </form>
              <form action="/api/admin/lti-tools" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={tool.id} />
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
