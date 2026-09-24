import Link from 'next/link';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

export default async function Certs({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(['ADMIN']);
  const params = await searchParams;

  const [certs, eligibleEnrollments, totalIssued] = await Promise.all([
    prisma.certificate.findMany({
      include: { user: true },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    }),
    prisma.enrollment.findMany({
      where: {
        OR: [{ completedAt: { not: null } }, { progress: { gte: 100 } }],
        certificate: null,
      },
      include: {
        user: true,
        course: { include: { instructor: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 100,
    }),
    prisma.certificate.count(),
  ]);

  return (
    <DashboardShell role="admin" title="Certificates">
      {params?.issued && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-black text-emerald-200">
          Certificate issued successfully.
        </div>
      )}
      {params?.exists && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-black text-amber-100">
          This enrollment already has a certificate.
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[#2F3336] bg-[#050505] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Issued certificates</p>
          <p className="mt-3 text-3xl font-black text-white">{totalIssued}</p>
        </div>
        <div className="rounded-3xl border border-[#2F3336] bg-[#050505] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Awaiting manual issue</p>
          <p className="mt-3 text-3xl font-black text-white">{eligibleEnrollments.length}</p>
        </div>
        <div className="rounded-3xl border border-[#2F3336] bg-[#050505] p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Automation</p>
          <p className="mt-3 text-sm font-bold text-zinc-300">Auto-issue runs when a student reaches 100% progress. Use manual issue for imports, fixes, and support cases.</p>
        </div>
      </div>

      <section className="mb-6 rounded-3xl border border-[#2F3336] bg-[#050505] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Manual certificate issue</p>
            <h2 className="mt-2 text-xl font-black text-white">Issue a certificate for a completed enrollment</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-zinc-400">
              Only enrollments with completed progress and no existing certificate appear here. Issuing fires add-on and platform webhook events.
            </p>
          </div>
          <Badge tone="blue">{eligibleEnrollments.length} eligible</Badge>
        </div>

        {eligibleEnrollments.length ? (
          <form action="/api/admin/certificates" method="post" className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <CsrfInput />
            <input type="hidden" name="action" value="issue" />
            <select name="enrollmentId" className="input-field" required>
              {eligibleEnrollments.map((enrollment) => (
                <option key={enrollment.id} value={enrollment.id}>
                  {enrollment.user.name} - {enrollment.course.title} - {enrollment.course.instructor.name} - {enrollment.progress}%
                </option>
              ))}
            </select>
            <button className="btn-primary">Issue certificate</button>
          </form>
        ) : (
          <p className="mt-5 rounded-2xl border border-[#2F3336] bg-black p-4 text-sm font-bold text-zinc-400">
            No completed enrollments are waiting for manual certificate issue.
          </p>
        )}
      </section>

      <DataTable
        headers={['Student', 'Course', 'Instructor', 'Code', 'Issued', 'Manage']}
        rows={certs.map((certificate) => [
          certificate.user.name,
          certificate.courseTitle,
          certificate.instructorName,
          <Link key="code" className="font-mono text-xs font-black text-[#1D9BF0]" href={`/certificates/${encodeURIComponent(certificate.code)}`}>
            {certificate.code}
          </Link>,
          certificate.issuedAt.toLocaleDateString(),
          <div key="manage" className="flex min-w-56 flex-wrap gap-2">
            <Link className="btn-secondary" href={`/certificates/verify?code=${encodeURIComponent(certificate.code)}`}>
              Verify
            </Link>
            <Link className="btn-secondary" href={`/certificates/${encodeURIComponent(certificate.code)}`}>
              Preview
            </Link>
            <form action="/api/admin/certificates" method="post">
          <CsrfInput />
              <input type="hidden" name="id" value={certificate.id} />
              <input type="hidden" name="action" value="delete" />
              <button className="btn-secondary">Delete</button>
            </form>
          </div>,
        ])}
      />
    </DashboardShell>
  );
}
