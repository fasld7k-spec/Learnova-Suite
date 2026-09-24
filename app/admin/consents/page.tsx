import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CheckCircle2, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Consents(props: { searchParams?: Promise<{ deleted?: string }> }) {
  const searchParams = await props.searchParams;
  await requireUser(['ADMIN']);
  const records = await prisma.consentRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const users = records.length
    ? await prisma.user.findMany({ where: { id: { in: records.map((record) => record.userId).filter(Boolean) as string[] } } })
    : [];
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const granted = records.filter((record) => record.granted).length;
  const denied = records.length - granted;
  const guest = records.filter((record) => !record.userId).length;
  const consentTypes = Array.from(new Set(records.map((record) => record.type))).sort();

  return (
    <DashboardShell role="admin" title="Consent Records">
      {searchParams?.deleted ? (
        <div className="mb-6 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
          Consent records deleted.
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Recent records" value={records.length} icon={<ShieldCheck size={18} />} />
        <StatCard label="Granted" value={granted} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Denied" value={denied} icon={<XCircle size={18} />} />
        <StatCard label="Guest records" value={guest} icon={<ShieldCheck size={18} />} />
      </div>

      <section className="mb-6 border border-[#2F3336] bg-black p-5">
        <h2 className="text-lg font-black text-white">Consent cleanup</h2>
        <p className="mt-2 text-sm leading-6 text-[#71767B]">
          Delete a consent type when cleaning test data or responding to privacy requests. Individual deletes are available in the table.
        </p>
        <form className="mt-4 flex flex-wrap gap-3" action="/api/admin/consents" method="post">
          <CsrfInput />
          <input type="hidden" name="_action" value="delete_type" />
          <select className="input max-w-sm" name="type" required>
            <option value="">Select consent type</option>
            {consentTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <button className="btn-secondary border-red-400/40 text-red-200">
            <Trash2 size={16} /> Delete type records
          </button>
        </form>
      </section>

      <DataTable
        headers={['User', 'Type', 'Granted', 'IP', 'Date', 'Action']}
        rows={records.map((record) => [
          record.userId ? userNames.get(record.userId) || 'User' : 'Guest',
          record.type,
          <Badge key="g" tone={record.granted ? 'green' : 'red'}>{record.granted ? 'Granted' : 'Denied'}</Badge>,
          record.ip || '-',
          record.createdAt.toLocaleString(),
          <form key="action" action="/api/admin/consents" method="post">
          <CsrfInput />
            <input type="hidden" name="_action" value="delete" />
            <input type="hidden" name="id" value={record.id} />
            <button className="btn-secondary border-red-400/40 text-xs text-red-200">Delete</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
