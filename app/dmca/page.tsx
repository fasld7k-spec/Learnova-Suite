import { FileSearch, MailWarning, RotateCcw } from 'lucide-react';
import { ManagedPage } from '@/components/ManagedPage';

const steps = [
  { title: 'Submit notice', body: 'Include the copyrighted work, the allegedly infringing URL, ownership statement, contact details, and signature.', icon: MailWarning },
  { title: 'Review', body: 'The platform reviews the notice, may remove or disable access, and may contact the affected instructor or account owner.', icon: FileSearch },
  { title: 'Counter notice', body: 'Affected users may submit a counter notice where applicable. Reinstatement depends on legal requirements and review outcome.', icon: RotateCcw }
];

export default function Dmca() {
  return (
    <ManagedPage slug="dmca" eyebrow="Legal" title="DMCA Policy" description="A notice-and-review workflow for copyright complaints involving course videos, downloads, text, images, or other platform content.">
      <div className="page-shell mt-8 grid gap-6 md:grid-cols-3">
          {steps.map(({ title, body, icon: Icon }) => (
            <div className="moe-panel moe-card-shine p-6" key={title}>
              <span className="moe-mini-icon">
                <Icon size={22} />
              </span>
              <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
            </div>
          ))}
      </div>
    </ManagedPage>
  );
}
