import { CalendarDays, CheckCircle2, Plus, Target } from 'lucide-react';

import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ProgressBar } from '@/components/dashboard/ProgressBar';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function goalPercent(progress: number, target: number) {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.min(100, Math.round((progress / target) * 100));
}

function formatDueDate(value: Date | null) {
  if (!value) return 'No due date';
  return value.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function Goals() {
  const user = await requireUser(['STUDENT']);
  const goals = await prisma.learningGoal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  const activeGoals = goals.filter((goal) => !goal.completed && goalPercent(goal.progress, goal.target) < 100).length;
  const completedGoals = goals.length - activeGoals;
  const totalTarget = goals.reduce((sum, goal) => sum + Math.max(0, goal.target), 0);
  const totalProgress = goals.reduce((sum, goal) => sum + Math.max(0, goal.progress), 0);
  const overallProgress = goalPercent(totalProgress, totalTarget);

  return (
    <DashboardShell role="student" title="Learning Goals">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="moe-panel rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="moe-mini-icon"><Target size={18} /></span>
            <p className="text-sm font-bold text-slate-400">Active goals</p>
          </div>
          <p className="mt-4 text-3xl font-black text-white">{activeGoals}</p>
        </div>
        <div className="moe-panel rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="moe-mini-icon"><CheckCircle2 size={18} /></span>
            <p className="text-sm font-bold text-slate-400">Completed</p>
          </div>
          <p className="mt-4 text-3xl font-black text-white">{completedGoals}</p>
        </div>
        <div className="moe-panel rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="moe-mini-icon"><CalendarDays size={18} /></span>
            <p className="text-sm font-bold text-slate-400">Overall progress</p>
          </div>
          <p className="mt-4 text-3xl font-black text-white">{overallProgress}%</p>
        </div>
      </div>

      <form className="moe-panel mb-6 grid gap-4 rounded-2xl p-5 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]" action="/api/student/goals" method="post">
        <CsrfInput />
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase text-slate-500">Goal</span>
          <input className="input" name="title" placeholder="Finish React fundamentals" maxLength={120} required />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase text-slate-500">Target lessons</span>
          <input className="input" name="target" type="number" min={1} max={1000} placeholder="24" required />
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase text-slate-500">Due date</span>
          <input className="input" name="dueDate" type="date" />
        </label>
        <button className="btn-primary mt-auto inline-flex min-h-11 items-center justify-center gap-2" type="submit">
          <Plus size={16} />
          Create
        </button>
      </form>

      {goals.length ? (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const percent = goalPercent(goal.progress, goal.target);
            const complete = goal.completed || percent >= 100;
            const dueDateValue = goal.dueDate ? goal.dueDate.toISOString().slice(0, 10) : '';

            return (
              <article className="moe-panel rounded-2xl p-5" key={goal.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black text-white">{goal.title}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${complete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-violet-500/15 text-violet-200'}`}>
                        {complete ? 'Completed' : 'In progress'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      {goal.progress}/{goal.target} lessons / {formatDueDate(goal.dueDate)}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-white">{percent}%</p>
                </div>
                <div className="mt-5">
                  <ProgressBar value={percent} />
                </div>
                <details className="mt-5 border-t border-[#2F3336] pt-4">
                  <summary className="cursor-pointer text-sm font-black text-[#1D9BF0]">Manage goal</summary>
                  <form className="mt-4 grid gap-3 md:grid-cols-[1.3fr_110px_110px_150px_auto]" action="/api/student/goals" method="post">
                    <CsrfInput />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="id" value={goal.id} />
                    <input className="input" name="title" defaultValue={goal.title} aria-label="Goal title" required />
                    <input className="input" name="target" type="number" min={1} max={1000} defaultValue={goal.target} aria-label="Target lessons" required />
                    <input className="input" name="progress" type="number" min={0} max={1000} defaultValue={goal.progress} aria-label="Progress" required />
                    <input className="input" name="dueDate" type="date" defaultValue={dueDateValue} aria-label="Due date" />
                    <label className="flex items-center gap-2 text-sm font-bold text-[#E7E9EA]">
                      <input type="checkbox" name="completed" defaultChecked={complete} /> Done
                    </label>
                    <button className="btn-secondary w-fit md:col-span-5">Update goal</button>
                  </form>
                  <form className="mt-3" action="/api/student/goals" method="post">
                    <CsrfInput />
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={goal.id} />
                    <button className="btn-secondary">Delete goal</button>
                  </form>
                </details>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No learning goals yet"
          description="Set a target for lessons, certificates, or weekly study time so your dashboard can track progress clearly."
        />
      )}
    </DashboardShell>
  );
}
