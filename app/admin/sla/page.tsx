import { AlarmClockCheck, Gauge, ShieldCheck, TimerReset } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export default async function Sla() {
  await requireUser(['ADMIN']);
  const rows = await prisma.slaPolicy.findMany({ orderBy: { createdAt: 'desc' } });

  const active = rows.filter((row) => row.active);
  const fastResponse = rows.filter((row) => row.responseHrs <= 4).length;
  const avgResponse = avg(rows.map((row) => row.responseHrs));
  const avgResolve = avg(rows.map((row) => row.resolveHrs));

  return (
    <DashboardShell role="admin" title="SLA Policies">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Policies" value={rows.length} icon={<ShieldCheck size={18} />} />
        <StatCard label="Active" value={active.length} icon={<Gauge size={18} />} />
        <StatCard label="Avg response" value={`${avgResponse}h`} icon={<AlarmClockCheck size={18} />} />
        <StatCard label="Avg resolve" value={`${avgResolve}h`} icon={<TimerReset size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/sla" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Support operations</p>
            <h2 className="mt-1 text-2xl font-black text-white">Define a response policy</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              SLA policies keep marketplace support measurable for learners, instructors, enterprise tenants and payment-related requests.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="input" name="name" placeholder="Standard" required />
            <input className="input" name="responseHrs" type="number" min="1" placeholder="Response hrs" required />
            <input className="input" name="resolveHrs" type="number" min="1" placeholder="Resolve hrs" required />
          </div>
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Policy</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Service design</p>
          <h3 className="mt-1 text-xl font-black text-white">Coverage readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Active default</span>
              <Badge tone={active.length ? 'green' : 'yellow'}>{active.length ? 'Ready' : 'Missing'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Fast response</span>
              <Badge tone={fastResponse ? 'green' : 'yellow'}>{fastResponse}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Resolution sanity</span>
              <Badge tone={rows.every((row) => row.resolveHrs >= row.responseHrs) ? 'green' : 'red'}>Checked</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Policy', 'Response', 'Resolve', 'Status', 'Created', 'Manage']}
          rows={rows.map((policy) => [
            <p key="name" className="font-bold text-white">{policy.name}</p>,
            `${policy.responseHrs}h`,
            `${policy.resolveHrs}h`,
            <Badge key="status" tone={policy.active ? 'green' : 'red'}>{policy.active ? 'Active' : 'Disabled'}</Badge>,
            policy.createdAt.toLocaleDateString(),
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/sla" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={policy.id} />
                <input className="input" name="name" defaultValue={policy.name} />
                <input className="input" name="responseHrs" type="number" min="1" defaultValue={policy.responseHrs} />
                <input className="input" name="resolveHrs" type="number" min="1" defaultValue={policy.resolveHrs} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={policy.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/sla" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={policy.id} />
                  <button className="btn-secondary">{policy.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/sla" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={policy.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
