import { Activity, RadioTower, ShieldCheck, Webhook } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

export default async function WebhookEndpoints() {
  await requireUser(['ADMIN']);
  const [endpoints, deliveries] = await Promise.all([
    prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.webhookDelivery.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  ]);

  const active = endpoints.filter((endpoint) => endpoint.active).length;
  const secured = endpoints.filter((endpoint) => endpoint.secret).length;
  const delivered = deliveries.filter((delivery) => delivery.status === 'SUCCESS').length;
  const deliveryCounts = new Map<string, number>();
  deliveries.forEach((delivery) => {
    deliveryCounts.set(delivery.endpointId, (deliveryCounts.get(delivery.endpointId) ?? 0) + 1);
  });

  return (
    <DashboardShell role="admin" title="Webhook Endpoints">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Endpoints" value={endpoints.length} icon={<Webhook size={18} />} />
        <StatCard label="Active" value={active} icon={<RadioTower size={18} />} />
        <StatCard label="Signed" value={secured} icon={<ShieldCheck size={18} />} />
        <StatCard label="Recent success" value={delivered} icon={<Activity size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/webhook-endpoints" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Integration delivery</p>
            <h2 className="mt-1 text-2xl font-black text-white">Register an endpoint</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Webhooks let buyers connect orders, enrollments, certificates and instructor events to their external systems.
            </p>
          </div>
          <div className="grid gap-3">
            <input className="input" name="name" placeholder="Endpoint name" required />
            <input className="input" name="url" type="url" placeholder="https://example.com/webhook" required />
            <input className="input" name="secret" placeholder="Signing secret optional" />
          </div>
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Endpoint</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Platform integrations</p>
          <h3 className="mt-1 text-xl font-black text-white">Delivery readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Active endpoints</span>
              <Badge tone={active ? 'green' : 'yellow'}>{active}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Signed endpoints</span>
              <Badge tone={secured === endpoints.length && endpoints.length ? 'green' : 'yellow'}>{secured}/{endpoints.length}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Delivery history</span>
              <Badge tone={deliveries.length ? 'green' : 'slate'}>{deliveries.length}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Endpoint', 'URL', 'Security', 'Deliveries', 'Status', 'Manage']}
          rows={endpoints.map((endpoint) => [
            <div key="endpoint">
              <p className="font-bold text-white">{endpoint.name}</p>
              <p className="mt-1 text-xs text-[#71767B]">Added {endpoint.createdAt.toLocaleDateString()}</p>
            </div>,
            <span key="url" className="max-w-xl break-all text-sm text-[#1D9BF0]">{endpoint.url}</span>,
            <Badge key="secret" tone={endpoint.secret ? 'green' : 'yellow'}>{endpoint.secret ? 'Signed' : 'Unsigned'}</Badge>,
            deliveryCounts.get(endpoint.id) ?? 0,
            <Badge key="active" tone={endpoint.active ? 'green' : 'red'}>{endpoint.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-72 gap-3">
              <details>
                <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit</summary>
                <form className="mt-3 grid gap-2" action="/api/admin/webhook-endpoints" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={endpoint.id} />
                  <input type="hidden" name="action" value="update" />
                  <input className="input" name="name" defaultValue={endpoint.name} required />
                  <input className="input" name="url" type="url" defaultValue={endpoint.url} required />
                  <input className="input" name="secret" placeholder={endpoint.secret ? 'Saved - leave blank to keep current secret' : 'Signing secret optional'} />
                  <div className="flex flex-wrap gap-4 text-sm font-bold text-[#E7E9EA]">
                    <label className="flex gap-2"><input type="checkbox" name="active" defaultChecked={endpoint.active} /> Active</label>
                    {endpoint.secret ? <label className="flex gap-2"><input type="checkbox" name="clearSecret" /> Clear signing secret</label> : null}
                  </div>
                  <button className="btn-primary w-fit">Save</button>
                </form>
              </details>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/webhook-endpoints" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={endpoint.id} />
                  <input type="hidden" name="action" value="toggle" />
                  <input type="hidden" name="active" value={endpoint.active ? 'false' : 'true'} />
                  <button className="btn-secondary">{endpoint.active ? 'Disable' : 'Activate'}</button>
                </form>
                <form action="/api/admin/webhook-endpoints" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={endpoint.id} />
                  <input type="hidden" name="action" value="delete" />
                  <button className="btn-secondary">Delete</button>
                </form>
              </div>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
