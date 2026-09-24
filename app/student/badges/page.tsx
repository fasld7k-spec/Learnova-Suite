import { Award, Trophy } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function Badges() {
  const user = await requireUser(['STUDENT']);
  const badges = await prisma.badgeAward.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });

  return (
    <DashboardShell role="student" title="Achievements">
      {badges.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          {badges.map((badge) => (
            <div className="card text-center" key={badge.id}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2F3336] bg-[#1D9BF0]/10 text-xl font-black text-[#1D9BF0]">
                {badge.icon || <Award size={26} />}
              </div>
              <h2 className="mt-3 text-xl font-black text-white">{badge.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#71767B]">{badge.reason}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#71767B]">{badge.createdAt.toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center">
          <Trophy className="mx-auto text-[#71767B]" size={42} />
          <h2 className="mt-4 text-xl font-black text-white">No achievements yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#71767B]">
            Complete lessons, pass quizzes, earn certificates, and your badges will appear here automatically.
          </p>
          <a className="btn-primary mt-4 w-fit" href="/student/my-courses">
            Continue learning
          </a>
        </div>
      )}
    </DashboardShell>
  );
}
