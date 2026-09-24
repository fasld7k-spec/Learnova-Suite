import { BadgeCheck, Handshake, UsersRound, WalletCards } from 'lucide-react';

import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/site-settings';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';

function money(value: unknown) {
  return Number(value || 0);
}

export default async function MentorPrograms() {
  const user = await requireUser(['INSTRUCTOR']);
  const [programs, enrollments] = await Promise.all([
    prisma.mentorProgram.findMany({ where: { instructorId: user.id }, orderBy: { createdAt: 'desc' } }),
    prisma.mentorEnrollment.findMany()
  ]);

  const active = programs.filter((program) => program.active).length;
  const programIds = new Set(programs.map((program) => program.id));
  const relevantEnrollments = enrollments.filter((enrollment) => programIds.has(enrollment.programId));
  const enrollmentCounts = new Map<string, number>();
  relevantEnrollments.forEach((enrollment) => {
    enrollmentCounts.set(enrollment.programId, (enrollmentCounts.get(enrollment.programId) ?? 0) + 1);
  });
  const listedValue = programs.reduce((sum, program) => sum + money(program.price), 0);

  return (
    <DashboardShell role="instructor" title="Mentor Programs">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Programs" value={programs.length} icon={<Handshake size={18} />} />
        <StatCard label="Active" value={active} icon={<BadgeCheck size={18} />} />
        <StatCard label="Enrollments" value={relevantEnrollments.length} icon={<UsersRound size={18} />} />
        <StatCard label="Listed value" value={formatMoney(listedValue)} icon={<WalletCards size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/instructor/mentor-programs" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Mentorship commerce</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a coaching offer</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Mentor programs let instructors sell guided support beside courses, making the marketplace feel deeper than video lessons alone.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <input className="input" name="title" placeholder="Program title" required />
            <input className="input" name="price" type="number" min="0" step="0.01" placeholder="Price" required />
          </div>
          <textarea className="input mt-3 min-h-28" name="description" placeholder="Description" required />
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Program</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Instructor revenue</p>
          <h3 className="mt-1 text-xl font-black text-white">Offer readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Active catalog</span>
              <Badge tone={active ? 'green' : 'yellow'}>{active}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Paid programs</span>
              <Badge tone={programs.some((program) => money(program.price) > 0) ? 'green' : 'yellow'}>{formatMoney(listedValue)}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Learner uptake</span>
              <Badge tone={relevantEnrollments.length ? 'green' : 'slate'}>{relevantEnrollments.length}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Program', 'Price', 'Enrollments', 'Status', 'Manage']}
          rows={programs.map((program) => [
            <div key="program">
              <p className="font-bold text-white">{program.title}</p>
              <p className="mt-1 line-clamp-1 text-xs text-[#71767B]">{program.description}</p>
            </div>,
            formatMoney(money(program.price)),
            enrollmentCounts.get(program.id) ?? 0,
            <Badge key="active" tone={program.active ? 'green' : 'red'}>{program.active ? 'Active' : 'Disabled'}</Badge>,
            <details key="manage" className="min-w-72">
              <summary className="cursor-pointer text-sm font-bold text-[#1D9BF0]">Edit</summary>
              <form className="mt-3 grid gap-3 border border-[#2F3336] p-3" action="/api/instructor/mentor-programs" method="post">
                <CsrfInput />
                <input type="hidden" name="action" value="update" />
                <input type="hidden" name="programId" value={program.id} />
                <input className="input" name="title" defaultValue={program.title} required />
                <input className="input" name="price" type="number" min="0" step="0.01" defaultValue={money(program.price)} required />
                <textarea className="input min-h-24" name="description" defaultValue={program.description} required />
                <label className="flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
                  <input type="checkbox" name="active" defaultChecked={program.active} /> Active
                </label>
                <button className="btn-primary w-fit">Save Program</button>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                <form action="/api/instructor/mentor-programs" method="post">
                  <CsrfInput />
                  <input type="hidden" name="action" value="toggle" />
                  <input type="hidden" name="programId" value={program.id} />
                  <input type="hidden" name="active" value={program.active ? 'false' : 'true'} />
                  <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-white hover:bg-[#16181C]">
                    {program.active ? 'Disable' : 'Activate'}
                  </button>
                </form>
                <form action="/api/instructor/mentor-programs" method="post">
                  <CsrfInput />
                  <input type="hidden" name="action" value="delete" />
                  <input type="hidden" name="programId" value={program.id} />
                  <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">Delete</button>
                </form>
              </div>
            </details>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
