import { Clock3, CreditCard, ReceiptText } from 'lucide-react';
import { ManagedPage } from '@/components/ManagedPage';

const items = [
  { title: 'Eligibility window', body: 'Refund eligibility depends on course access, completion progress, promotional terms, and local consumer protection rules.', icon: Clock3 },
  { title: 'Payment method', body: 'Approved refunds are returned through the original payment method when the connected payment provider supports it.', icon: CreditCard },
  { title: 'Review process', body: 'Admins can review refund requests, order history, course consumption, and policy exceptions before issuing a decision.', icon: ReceiptText }
];

export default function RefundPolicy() {
  return (
    <ManagedPage slug="refund-policy" eyebrow="Legal" title="Refund Policy" description="Define how learners request refunds, how requests are reviewed, and how approved refunds are processed.">
      <div className="mt-8 grid gap-6 md:grid-cols-3">
          {items.map(({ title, body, icon: Icon }) => (
            <div className="border border-[#2F3336] bg-black p-6" key={title}>
              <Icon size={22} className="text-[#1D9BF0]" />
              <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#71767B]">{body}</p>
            </div>
          ))}
      </div>
    </ManagedPage>
  );
}
