import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ProgressBar } from '@/components/dashboard/ProgressBar';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function MyLearningPaths() {
  const user = await requireUser(['STUDENT']);
  const enrollments = await prisma.learningPathEnrollment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
  const paths = enrollments.length
    ? await prisma.learningPath.findMany({ where: { id: { in: enrollments.map((row) => row.learningPathId) } } })
    : [];
  const pathById = new Map(paths.map((path) => [path.id, path]));

  return (
    <DashboardShell role="student" title="My Learning Paths">
      {enrollments.length ? (
        <div className="grid gap-4">
          {enrollments.map((enrollment) => {
            const path = pathById.get(enrollment.learningPathId);
            return (
              <div className="card" key={enrollment.id}>
                <h2 className="text-xl font-bold">{path?.title || 'Archived learning path'}</h2>
                {path?.description && <p className="mt-2 text-sm leading-6 text-[#71767B]">{path.description}</p>}
                <div className="mt-4">
                  <ProgressBar value={enrollment.progress} />
                </div>
                <p className="mt-2 text-sm text-[#71767B]">{enrollment.progress}% complete</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-[#2F3336] bg-black p-6">
          <p className="text-lg font-bold text-white">No learning paths yet</p>
          <p className="mt-2 text-sm leading-6 text-[#71767B]">Enroll in a learning path to see your progress here.</p>
        </div>
      )}
    </DashboardShell>
  );
}
