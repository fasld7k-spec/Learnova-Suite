import { TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

export function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <article className="dashboard-stat-card group rounded-xl p-5 transition duration-200 hover:-translate-y-1 hover:border-violet-300/45">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <div className="mt-3 text-3xl font-black leading-none text-white">{value}</div>
        </div>
        <span className="moe-mini-icon dashboard-stat-icon shrink-0 transition group-hover:scale-105">
          {icon || <TrendingUp size={18} strokeWidth={1.8} />}
        </span>
      </div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
        <span className="dashboard-stat-spark block h-full w-2/3 rounded-full" />
      </div>
    </article>
  );
}
