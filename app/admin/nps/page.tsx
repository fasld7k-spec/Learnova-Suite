import { Download } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function NpsAdmin({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const params = await searchParams;
  const responses = await prisma.npsResponse.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const users = responses.length
    ? await prisma.user.findMany({ where: { id: { in: responses.map((response) => response.userId).filter(Boolean) as string[] } } })
    : [];
  const userLabels = new Map(users.map((user) => [user.id, `${user.name} (${user.email})`]));
  const average = responses.length ? Math.round((responses.reduce((sum, response) => sum + response.score, 0) / responses.length) * 10) / 10 : 0;
  const promoters = responses.filter((response) => response.score >= 9).length;
  const passives = responses.filter((response) => response.score >= 7 && response.score <= 8).length;
  const detractors = responses.filter((response) => response.score <= 6).length;
  const npsScore = responses.length ? Math.round(((promoters - detractors) / responses.length) * 100) : 0;

  return (
    <DashboardShell role="admin" title="NPS Feedback">
      {params?.purged && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-black text-emerald-200">
          NPS segment purged successfully.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="NPS Score" value={npsScore} />
        <StatCard label="Average Score" value={average} />
        <StatCard label="Promoters" value={promoters} />
        <StatCard label="Passives" value={passives} />
        <StatCard label="Detractors" value={detractors} />
      </div>

      <section className="mt-6 border border-[#2F3336] bg-black p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#71767B]">NPS operations</p>
            <h2 className="mt-2 text-xl font-black text-white">Analyze, export, and clean feedback</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#71767B]">
              Export all responses for external analysis or clean a specific response segment after support follow-up.
            </p>
          </div>
          <a className="btn-primary" href="/api/admin/nps">
            <Download size={16} />
            Export CSV
          </a>
        </div>
        {responses.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { segment: 'promoters', count: promoters },
              { segment: 'passives', count: passives },
              { segment: 'detractors', count: detractors },
            ].map(({ segment, count }) => (
              <form action="/api/admin/nps" method="post" key={segment}>
                <CsrfInput />
                <input type="hidden" name="_action" value="purge-segment" />
                <input type="hidden" name="segment" value={segment} />
                <button className="btn-secondary border-red-400/40 text-red-200" disabled={!count}>
                  Purge {segment} ({count})
                </button>
              </form>
            ))}
            <form action="/api/admin/nps" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="clear" />
              <button className="btn-secondary border-red-400/40 text-red-200">Clear all NPS responses</button>
            </form>
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        <DataTable
          headers={['User', 'Score', 'Segment', 'Comment', 'Date', 'Action']}
          rows={responses.map((response) => [
            response.userId ? userLabels.get(response.userId) || 'Registered user' : 'Guest',
            response.score,
            <Badge key="segment" tone={response.score >= 9 ? 'green' : response.score >= 7 ? 'yellow' : 'red'}>
              {response.score >= 9 ? 'Promoter' : response.score >= 7 ? 'Passive' : 'Detractor'}
            </Badge>,
            response.comment || '-',
            response.createdAt.toLocaleDateString(),
            <form key="action" action="/api/admin/nps" method="post">
              <CsrfInput />
              <input type="hidden" name="_action" value="delete" />
              <input type="hidden" name="id" value={response.id} />
              <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
            </form>,
          ])}
        />
      </div>
    </DashboardShell>
  );
}
