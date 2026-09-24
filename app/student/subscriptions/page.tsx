import Link from 'next/link';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney, getSiteSettings } from '@/lib/site-settings';

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'green' as const;
  if (status === 'PENDING') return 'yellow' as const;
  if (status === 'CANCELED') return 'red' as const;
  return 'slate' as const;
}

export default async function MySubscriptions() {
  const user = await requireUser(['STUDENT']);
  const [subscriptions, settings] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: 'desc' } }),
    getSiteSettings(),
  ]);

  return (
    <DashboardShell role="student" title="My Subscriptions">
      <div className="ui-panel mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="eyebrow">Membership access</p>
          <h2 className="mt-2 text-2xl font-black text-white">Plans, renewals, and approvals</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8A949E]">
            Paid access plans become active after checkout or admin approval. Sandbox checkout records one-time access orders, not recurring gateway billing.
          </p>
        </div>
        <Link className="btn-primary" href="/subscriptions">Browse Plans</Link>
      </div>

      <DataTable
        headers={['Plan', 'Price', 'Status', 'Started', 'Ends', 'Manage']}
        rows={subscriptions.map((subscription) => [
          <span key="plan" className="font-black text-white">{subscription.plan.name}</span>,
          `${formatMoney(subscription.plan.price, settings.currency)} / ${subscription.plan.interval}`,
          <Badge key="s" tone={statusTone(subscription.status)}>{subscription.status}</Badge>,
          subscription.startsAt.toLocaleDateString(),
          subscription.endsAt.toLocaleDateString(),
          subscription.status !== 'CANCELED' ? (
            <form key="cancel" action="/api/student/subscriptions/status" method="post">
              <CsrfInput />
              <input type="hidden" name="id" value={subscription.id} />
              <input type="hidden" name="status" value="CANCELED" />
              <button className="btn-secondary min-h-9 px-3">Cancel</button>
            </form>
          ) : (
            <span key="done" className="text-sm text-[#71767B]">Canceled</span>
          ),
        ])}
      />
    </DashboardShell>
  );
}
