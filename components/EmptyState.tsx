import { Inbox } from 'lucide-react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="moe-panel rounded-xl border-dashed p-8 text-center sm:p-10">
      <div className="moe-mini-icon mx-auto">
        <Inbox size={22} strokeWidth={1.8} />
      </div>
      <h3 className="mt-4 text-xl font-black text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
