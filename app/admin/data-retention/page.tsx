import { ArchiveRestore, CalendarDays, DatabaseZap, ShieldCheck } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';
import { retentionCleanupModel } from '@/lib/data-retention';

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function parseCleanupEvidence(metadata: string | null) {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as { dryRun?: boolean; eligible?: number; deleted?: number; limit?: number };
  } catch {
    return null;
  }
}

export default async function DataRetention() {
  await requireUser(['ADMIN']);
  const [policies, lastCleanup] = await Promise.all([
    prisma.dataRetentionPolicy.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findFirst({
      where: { action: { in: ['data_retention.cleanup', 'data_retention.cleanup_dry_run'] } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const active = policies.filter((policy) => policy.active).length;
  const shortWindow = policies.filter((policy) => policy.days <= 90).length;
  const avgDays = avg(policies.map((policy) => policy.days));
  const entities = new Set(policies.map((policy) => policy.entity)).size;
  const cleanupReady = policies.filter((policy) => policy.active && retentionCleanupModel(policy.entity)).length;
  const cleanupEvidence = parseCleanupEvidence(lastCleanup?.metadata ?? null);

  return (
    <DashboardShell role="admin" title="Data Retention">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Policies" value={policies.length} icon={<ArchiveRestore size={18} />} />
        <StatCard label="Active" value={active} icon={<ShieldCheck size={18} />} />
        <StatCard label="Avg retention" value={`${avgDays}d`} icon={<CalendarDays size={18} />} />
        <StatCard label="Cleanup-ready" value={cleanupReady} icon={<DatabaseZap size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/data-retention" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Compliance operations</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a retention policy</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Retention policies show buyers how long operational, audit, support and learning records stay available before cleanup.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <input className="input" name="entity" placeholder="orders/logs/messages" required />
            <input className="input" name="days" type="number" min="1" placeholder="365" required />
          </div>
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Policy</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Governance readiness</p>
          <h3 className="mt-1 text-xl font-black text-white">Retention coverage</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Active rules</span>
              <Badge tone={active ? 'green' : 'yellow'}>{active}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Short windows</span>
              <Badge tone={shortWindow ? 'green' : 'slate'}>{shortWindow}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Entity coverage</span>
              <Badge tone={entities >= 3 ? 'green' : 'yellow'}>{entities}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Cleanup-ready</span>
              <Badge tone={cleanupReady ? 'green' : 'yellow'}>{cleanupReady}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/data-retention" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="cleanup" />
          <input type="hidden" name="requireSelection" value="true" />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Enforce cleanup</p>
            <h2 className="mt-1 text-2xl font-black text-white">Run active retention policies</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Cleanup only touches supported operational records with a created date older than the active policy window. Destructive runs are capped.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <select className="input" name="mode" defaultValue="dry-run">
              <option value="dry-run">Dry run</option>
              <option value="delete">Delete eligible rows</option>
            </select>
            <input className="input" name="limit" type="number" min="1" max="1000" defaultValue={100} aria-label="Cleanup limit" />
          </div>
          <div className="mt-4 grid gap-2">
            {policies.filter((policy) => policy.active).map((policy) => {
              const model = retentionCleanupModel(policy.entity);
              return (
                <label key={policy.id} className="flex items-center justify-between gap-3 border border-[#2F3336] px-4 py-3 text-sm text-[#E7E9EA]">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" name="policyId" value={policy.id} disabled={!model} defaultChecked={Boolean(model)} />
                    <code className="text-xs text-[#1D9BF0]">{policy.entity}</code>
                  </span>
                  <Badge tone={model ? 'green' : 'slate'}>{model || 'Unsupported'}</Badge>
                </label>
              );
            })}
          </div>
          <button className="btn-primary mt-4 w-fit" disabled={!cleanupReady}>Run Cleanup</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Last run evidence</p>
          <h3 className="mt-1 text-xl font-black text-white">{lastCleanup ? lastCleanup.createdAt.toLocaleString() : 'No cleanup runs yet'}</h3>
          {cleanupEvidence ? (
            <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
              <div className="flex items-center justify-between gap-3">
                <span>Mode</span>
                <Badge tone={cleanupEvidence.dryRun ? 'yellow' : 'green'}>{cleanupEvidence.dryRun ? 'Dry run' : 'Delete'}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Eligible rows</span>
                <Badge tone={cleanupEvidence.eligible ? 'yellow' : 'slate'}>{cleanupEvidence.eligible ?? 0}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Deleted rows</span>
                <Badge tone={cleanupEvidence.deleted ? 'green' : 'slate'}>{cleanupEvidence.deleted ?? 0}</Badge>
              </div>
              <p className="text-xs leading-5 text-[#71767B]">Audit action: {lastCleanup?.action}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#71767B]">Run a dry cleanup first to capture policy coverage, eligible counts, and the deletion cap in the audit log.</p>
          )}
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Entity', 'Retention', 'Cleanup action', 'Status', 'Manage']}
          rows={policies.map((policy) => [
            <code key="entity" className="text-xs text-[#1D9BF0]">{policy.entity}</code>,
            `${policy.days} days`,
            <Badge key="cleanup" tone={retentionCleanupModel(policy.entity) ? 'green' : 'yellow'}>
              {retentionCleanupModel(policy.entity) || 'Needs mapping'}
            </Badge>,
            <Badge key="active" tone={policy.active ? 'green' : 'red'}>{policy.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-80 gap-2">
              <form className="grid gap-2" action="/api/admin/data-retention" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={policy.id} />
                <input className="input" name="entity" defaultValue={policy.entity} />
                <input className="input" name="days" type="number" min="1" max="3650" defaultValue={policy.days} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={policy.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/data-retention" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={policy.id} />
                  <button className="btn-secondary">{policy.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/data-retention" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="cleanup" />
                  <input type="hidden" name="requireSelection" value="true" />
                  <input type="hidden" name="policyId" value={policy.id} />
                  <input type="hidden" name="mode" value="dry-run" />
                  <input type="hidden" name="limit" value="100" />
                  <button className="btn-secondary" disabled={!policy.active || !retentionCleanupModel(policy.entity)}>Dry run</button>
                </form>
                <form action="/api/admin/data-retention" method="post">
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
