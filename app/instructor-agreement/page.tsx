import { HandCoins, Handshake, ScrollText } from 'lucide-react';
import { ManagedPage } from '@/components/ManagedPage';

const sections = [
  { title: 'Commercial terms', body: 'Revenue share, taxes, payout timing, refunds, chargebacks, and marketplace fees should match your configured business model.', icon: HandCoins },
  { title: 'Publishing license', body: 'Instructors grant the platform permission to host, market, stream, and deliver submitted course materials to enrolled learners.', icon: ScrollText },
  { title: 'Relationship', body: 'The instructor relationship is independent unless a separate written agreement says otherwise.', icon: Handshake }
];

export default function InstructorAgreement() {
  return (
    <ManagedPage slug="instructor-agreement" eyebrow="Legal" title="Instructor Agreement" description="Agreement terms for instructor participation, publishing rights, compensation, and platform responsibilities.">
      <div className="page-shell mt-8 grid gap-6 md:grid-cols-3">
          {sections.map(({ title, body, icon: Icon }) => (
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
