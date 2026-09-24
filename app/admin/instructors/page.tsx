import { CheckCircle2, Clock3, GraduationCap, ShieldCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

function statusTone(status: string) {
  if (status === 'APPROVED') return 'green';
  if (status === 'PENDING') return 'yellow';
  return 'red';
}

export default async function Instructors() {
  await requireUser(['ADMIN']);
  const instructors = await prisma.user.findMany({
    where: { role: 'INSTRUCTOR' },
    include: {
      _count: { select: { courses: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const approved = instructors.filter((instructor) => instructor.status === 'APPROVED').length;
  const pending = instructors.filter((instructor) => instructor.status === 'PENDING').length;
  const withCourses = instructors.filter((instructor) => instructor._count.courses > 0).length;

  return (
    <DashboardShell role="admin" title="Instructor Approvals">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Instructors" value={instructors.length} icon={<GraduationCap size={18} />} />
        <StatCard label="Approved" value={approved} icon={<ShieldCheck size={18} />} />
        <StatCard label="Pending review" value={pending} icon={<Clock3 size={18} />} />
        <StatCard label="With courses" value={withCourses} icon={<CheckCircle2 size={18} />} />
      </div>

      <div className="mt-6 grid gap-4 2xl:grid-cols-[1fr_320px]">
        <section>
          <h2 className="text-lg font-black text-white">Instructor Review Desk</h2>
          <p className="mb-3 mt-1 text-sm font-semibold text-[#71767B]">Approve trusted instructors, reject incomplete applications and keep internal review notes.</p>
          <DataTable
            headers={['Instructor', 'Status', 'Catalog', 'Joined', 'Actions', 'Internal note']}
            rows={instructors.map((instructor) => [
              <div key="profile" className="min-w-[220px]">
                <p className="font-bold text-white">{instructor.name}</p>
                <p className="mt-1 text-xs font-semibold text-[#71767B]">{instructor.email}</p>
              </div>,
              <Badge key="status" tone={statusTone(instructor.status)}>{instructor.status}</Badge>,
              `${instructor._count.courses} courses`,
              instructor.createdAt.toLocaleDateString(),
              <div key="actions" className="flex flex-wrap gap-2">
                <form action="/api/admin/instructors/approve" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={instructor.id} />
                  <button className="btn-primary">Approve</button>
                </form>
                <form action="/api/admin/instructors/reject" method="post">
          <CsrfInput />
                  <input type="hidden" name="id" value={instructor.id} />
                  <button className="btn border">Reject</button>
                </form>
              </div>,
              <form key="note" action="/api/admin/instructor-notes" method="post" className="flex min-w-[260px] gap-2">
          <CsrfInput />
                <input type="hidden" name="instructorId" value={instructor.id} />
                <input className="input" name="note" placeholder="Portfolio reviewed, payout details pending" />
                <button className="btn border">Add</button>
              </form>
            ])}
          />
        </section>

        <aside className="border border-[#2F3336] bg-black p-5">
          <h2 className="text-lg font-black text-white">Approval Checklist</h2>
          <ul className="mt-4 grid gap-3 text-sm font-semibold text-[#71767B]">
            <li>Profile name and email look legitimate.</li>
            <li>At least one course draft has useful lesson structure.</li>
            <li>Bio, expertise and payout expectations are clear.</li>
            <li>Rejected instructors can reapply after fixing profile quality.</li>
          </ul>
        </aside>
      </div>
    </DashboardShell>
  );
}
