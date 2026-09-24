import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';
import { CsrfInput } from '@/components/CsrfInput';

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'green' as const;
  if (status === 'PENDING') return 'yellow' as const;
  if (status === 'CANCELED') return 'red' as const;
  return 'slate' as const;
}

export default async function SubscriptionPlans() {
  await requireUser(['ADMIN']);

  const [plans, pendingPaidSubscriptions, settings] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.findMany({
      where: { status: 'PENDING', plan: { price: { gt: 0 } } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    getSiteSettings(),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(pendingPaidSubscriptions.map((subscription) => subscription.userId))) } },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return (
    <DashboardShell role="admin" title="Subscription Plans">
      <form className="card mb-6 grid gap-3" action="/api/admin/subscription-plans" method="post">
          <CsrfInput />
        <input type="hidden" name="_action" value="save" />
        <div className="grid gap-3 md:grid-cols-4">
          <input className="input" name="name" placeholder="Plan name" required />
          <input className="input" name="slug" placeholder="plan-slug" required />
          <input className="input" name="price" type="number" min="0" step="0.01" placeholder="Price" required />
          <select className="input" name="interval" defaultValue="monthly">
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <textarea className="input" name="features" placeholder="Features, one per line" />
        <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
          <input name="active" type="checkbox" defaultChecked />
          Active
        </label>
        <button className="btn-primary w-fit">Save Plan</button>
      </form>

      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Paid subscription approvals</h2>
            <p className="mt-1 text-sm text-[#71767B]">
              Review pending paid subscription checkouts before granting access.
            </p>
          </div>
          <Badge tone={pendingPaidSubscriptions.length ? 'yellow' : 'green'}>
            {pendingPaidSubscriptions.length} pending
          </Badge>
        </div>
      </div>

      <DataTable
        headers={['Student', 'Plan', 'Price', 'Requested', 'Status', 'Actions']}
        rows={pendingPaidSubscriptions.map((subscription) => {
          const user = usersById.get(subscription.userId);
          return [
            <div key="student">
              <div className="font-bold">{user?.name || 'Unknown student'}</div>
              <div className="text-xs text-[#71767B]">{user?.email || subscription.userId}</div>
            </div>,
            subscription.plan.name,
            formatMoney(subscription.plan.price, settings.currency),
            subscription.createdAt.toLocaleString(),
            <Badge key="status" tone={statusTone(subscription.status)}>{subscription.status}</Badge>,
            <div key="actions" className="flex flex-wrap gap-2">
              <form action="/api/admin/subscriptions/status" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={subscription.id} />
                <input type="hidden" name="status" value="ACTIVE" />
                <button className="btn-primary min-h-9 px-3">Approve</button>
              </form>
              <form action="/api/admin/subscriptions/status" method="post">
          <CsrfInput />
                <input type="hidden" name="id" value={subscription.id} />
                <input type="hidden" name="status" value="CANCELED" />
                <button className="btn-secondary min-h-9 px-3">Cancel</button>
              </form>
            </div>,
          ];
        })}
      />

      <div className="mt-6">
        <DataTable
          headers={['Name', 'Slug', 'Price', 'Interval', 'Status', 'Subscriptions', 'Actions']}
          rows={plans.map((plan) => [
            <span className="font-bold" key="name">{plan.name}</span>,
            plan.slug,
            formatMoney(plan.price, settings.currency),
            plan.interval,
            <Badge key="active" tone={plan.active ? 'green' : 'red'}>{plan.active ? 'Active' : 'Disabled'}</Badge>,
            String(plan._count.subscriptions),
            <div key="actions" className="grid min-w-[360px] gap-3">
              <details>
                <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Edit plan</summary>
                <form className="mt-3 grid gap-2" action="/api/admin/subscription-plans" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="save" />
                  <input className="input" name="name" defaultValue={plan.name} required />
                  <input className="input" name="slug" defaultValue={plan.slug} required />
                  <input className="input" name="price" type="number" min="0" step="0.01" defaultValue={String(plan.price)} required />
                  <select className="input" name="interval" defaultValue={plan.interval}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <textarea className="input min-h-24" name="features" defaultValue={fromJsonArray<string>(plan.features).join('\n')} placeholder="Features, one per line" />
                  <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                    <input name="active" type="checkbox" defaultChecked={plan.active} />
                    Active
                  </label>
                  <button className="btn-primary w-fit">Save changes</button>
                </form>
              </details>
              <div className="flex flex-wrap gap-2">
              <form action="/api/admin/subscription-plans" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="status" />
                <input type="hidden" name="id" value={plan.id} />
                <input type="hidden" name="active" value={plan.active ? 'false' : 'true'} />
                <button className="btn-secondary min-h-9 px-3">{plan.active ? 'Disable' : 'Activate'}</button>
              </form>
              <form action="/api/admin/subscription-plans" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={plan.id} />
                <button className="btn-secondary min-h-9 px-3" disabled={plan._count.subscriptions > 0}>
                  Delete
                </button>
              </form>
              </div>
            </div>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
