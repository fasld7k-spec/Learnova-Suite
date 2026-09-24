import { Badge } from '@/components/dashboard/Badge';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function AutomationRuns(props: { searchParams?: Promise<{ cleared?: string; ran?: string; retried?: string; deleted?: string }> }) {
  await requireUser(['ADMIN']);
  const params = await props.searchParams;

  const [rows, rules, totalCount, successTotal, failedTotal] = await Promise.all([
    prisma.automationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.automationRule.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, trigger: true, active: true } }),
    prisma.automationRun.count(),
    prisma.automationRun.count({ where: { status: 'SUCCESS' } }),
    prisma.automationRun.count({ where: { NOT: { status: 'SUCCESS' } } }),
  ]);
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const successCount = rows.filter((run) => run.status === 'SUCCESS').length;
  const failedCount = rows.filter((run) => run.status !== 'SUCCESS').length;

  return (
    <DashboardShell role="admin" title="Automation Runs">
      {(params?.cleared || params?.ran || params?.retried || params?.deleted) && (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          {params?.cleared ? `Cleared ${params.cleared} automation run(s). ` : ''}
          {params?.ran ? `Manual run finished with ${params.ran}. ` : ''}
          {params?.retried ? `Retry finished with ${params.retried}. ` : ''}
          {params?.deleted ? 'Automation run deleted.' : ''}
        </div>
      )}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total runs" value={totalCount} />
        <StatCard label="Successful" value={successTotal} />
        <StatCard label="Needs review" value={failedTotal} />
        <StatCard label="Rules" value={rules.length} />
      </div>
      <div className="card mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Automation execution log</h2>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">
            Review recent rule executions, keep failed runs for investigation, and clear successful noise after launch checks.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="green">{successCount} success</Badge>
            <Badge tone={failedCount ? 'red' : 'slate'}>{failedCount} needs review</Badge>
          </div>
        </div>
        <form action="/api/admin/automation-runs" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="clear-success" />
          <button className="btn-secondary">Clear successful runs</button>
        </form>
      </div>
      <div className="card mb-6 grid gap-4 md:grid-cols-2">
        <form className="grid gap-3" action="/api/admin/automation-runs" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="run-rule" />
          <div>
            <h3 className="text-lg font-black text-white">Run selected rule</h3>
            <p className="mt-2 text-sm text-[#71767B]">Trigger a rule with a safe admin test payload to verify email, notification, and tagging setup.</p>
          </div>
          <select className="input" name="id" required>
            <option value="">Select automation rule</option>
            {rules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.name} - {rule.trigger} {rule.active ? '' : '(disabled)'}
              </option>
            ))}
          </select>
          <button className="btn-primary w-fit">Run rule now</button>
        </form>
        <form className="grid gap-3" action="/api/admin/automation-runs" method="post">
          <CsrfInput />
          <input type="hidden" name="action" value="clear-old" />
          <div>
            <h3 className="text-lg font-black text-white">Retention cleanup</h3>
            <p className="mt-2 text-sm text-[#71767B]">Remove old execution records after exporting logs when the table gets noisy.</p>
          </div>
          <input className="input" name="days" type="number" min="7" defaultValue={90} />
          <button className="btn-secondary w-fit">Clear old runs</button>
        </form>
      </div>

      <DataTable
        headers={['Rule', 'Status', 'Log', 'Date', 'Manage']}
        rows={rows.map((run) => {
          const rule = rulesById.get(run.ruleId);
          return [
          rule ? `${rule.name} (${rule.trigger})` : run.ruleId,
          <Badge key="s" tone={run.status === 'SUCCESS' ? 'green' : 'red'}>{run.status}</Badge>,
          <span key="log" className="max-w-lg whitespace-pre-wrap text-sm text-[#E7E9EA]">{run.log || '-'}</span>,
          run.createdAt.toLocaleString(),
          <div key="manage" className="flex flex-wrap gap-2">
            {rule && (
              <form action="/api/admin/automation-runs" method="post">
                <CsrfInput />
                <input type="hidden" name="id" value={run.id} />
                <input type="hidden" name="action" value="retry" />
                <button className="btn-secondary">Retry</button>
              </form>
            )}
            <form action="/api/admin/automation-runs" method="post">
              <CsrfInput />
              <input type="hidden" name="id" value={run.id} />
              <input type="hidden" name="action" value="delete" />
              <button className="btn-secondary">Delete</button>
            </form>
          </div>,
        ];
        })}
      />
    </DashboardShell>
  );
}
