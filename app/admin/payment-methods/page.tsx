import { CreditCard, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/dashboard/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { fromJsonObject } from '@/lib/json-fields';
import { CsrfInput } from '@/components/CsrfInput';

type PaymentMethodRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  instructions: string | null;
  config: string | null;
};

const methodExamples = [
  {
    name: 'Bank Transfer',
    slug: 'bank-transfer',
    instructions: 'Transfer the exact invoice total to Bank ABC, IBAN EG00 0000 0000 0000, then upload the transfer reference from the manual payment page.',
  },
  {
    name: 'Vodafone Cash',
    slug: 'vodafone-cash',
    instructions: 'Send the total amount to +20 100 000 0000 and write your phone number plus order invoice number in the payment reference.',
  },
  {
    name: 'Instapay',
    slug: 'instapay',
    instructions: 'Pay to yourname@instapay, then submit the transaction ID so the admin team can approve the order.',
  },
];

export default async function PaymentMethods() {
  await requireUser(['ADMIN']);
  const rows = await prisma.paymentMethod.findMany({ orderBy: { name: 'asc' } });
  const active = rows.filter((method) => method.active).length;
  const configuredInstructions = rows.filter((method) => method.instructions?.trim()).length;

  return (
    <DashboardShell role="admin" title="Payment Methods">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Methods" value={rows.length} icon={<CreditCard size={18} />} />
        <StatCard label="Active" value={active} icon={<ToggleRight size={18} />} />
        <StatCard label="Disabled" value={rows.length - active} icon={<ToggleLeft size={18} />} />
        <StatCard label="With instructions" value={configuredInstructions} icon={<FileText size={18} />} />
      </div>

      <div className="mt-6 grid gap-4 2xl:grid-cols-[420px_1fr]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/payment-methods" method="post">
          <CsrfInput />
          <h2 className="text-lg font-black text-white">Create Or Update Method</h2>
          <p className="mt-1 text-sm font-semibold text-[#71767B]">Use this for manual bank transfer, offline approval, wallets, local cash methods, or any custom payment option shown during checkout.</p>
          <div className="mt-5 grid gap-3">
            <label className="grid gap-2 text-sm font-bold text-[#E7E9EA]">
              Method name
              <input className="input" name="name" placeholder="Bank transfer" required />
              <span className="text-xs font-semibold leading-5 text-[#71767B]">
                What to enter: the buyer-facing name shown at checkout. Use a clear label such as Bank Transfer, Vodafone Cash, Instapay, PayPal Manual, or Cash Payment.
              </span>
            </label>

            <label className="grid gap-2 text-sm font-bold text-[#E7E9EA]">
              Slug
              <input className="input" name="slug" placeholder="bank-transfer" required />
              <span className="text-xs font-semibold leading-5 text-[#71767B]">
                What to enter: a unique lowercase identifier used by checkout and URLs. Use letters, numbers, and hyphens only, for example bank-transfer or vodafone-cash. Custom slugs are saved as offline/manual payment methods automatically.
              </span>
            </label>

            <label className="grid gap-2 text-sm font-bold text-[#E7E9EA]">
              Customer instructions
              <textarea className="input min-h-32" name="instructions" placeholder="Customer instructions, reference format, bank details or gateway notes" />
              <span className="text-xs font-semibold leading-5 text-[#71767B]">
                What to enter: the exact steps the customer must follow after choosing this method. Include account number, wallet number, IBAN, reference format, receipt upload notes, approval time, and support contact if needed.
              </span>
            </label>

            <label className="flex items-start gap-3 border border-[#2F3336] bg-[#050608] p-4 text-sm font-bold text-[#E7E9EA]">
              <input className="mt-1" type="checkbox" name="active" defaultChecked />
              <span>
                Active at checkout
                <span className="mt-1 block text-xs font-semibold leading-5 text-[#71767B]">
                  Turn this on when customers should see the method during checkout. Turn it off to keep the method saved but hidden.
                </span>
              </span>
            </label>
            <button className="btn-primary w-fit">Save Method</button>
          </div>

          <div className="mt-6 border border-[#2F3336] bg-[#050608] p-4">
            <h3 className="text-sm font-black text-white">Quick examples</h3>
            <div className="mt-3 grid gap-3">
              {methodExamples.map((example) => (
                <div className="border border-[#2F3336] p-3" key={example.slug}>
                  <p className="text-sm font-black text-white">{example.name}</p>
                  <code className="mt-1 block text-xs text-[#1D9BF0]">{example.slug}</code>
                  <p className="mt-2 text-xs leading-5 text-[#71767B]">{example.instructions}</p>
                </div>
              ))}
            </div>
          </div>
        </form>

        <section>
          <h2 className="text-lg font-black text-white">Checkout Method Registry</h2>
          <p className="mb-3 mt-1 text-sm font-semibold text-[#71767B]">Keep buyer-facing payment instructions explicit so reviewers can complete checkout without external accounts.</p>
          <div className="mb-4 grid gap-3 border border-[#2F3336] bg-black p-4 text-sm leading-6 text-[#71767B] md:grid-cols-2">
            <div>
              <p className="font-black text-white">Payment Methods</p>
              <p className="mt-1">Use this page for checkout options and manual/offline customer instructions.</p>
              <p className="mt-2 text-xs font-semibold text-[#1D9BF0]">Custom methods created here are fully wired to the manual payment flow and order approval screen.</p>
            </div>
            <div>
              <p className="font-black text-white">Payment Gateways</p>
              <p className="mt-1">Use Payment Gateways for provider API keys, hosted checkout URLs, webhooks, and live/sandbox configuration.</p>
            </div>
          </div>
          <DataTable
            headers={['Method', 'Slug', 'Mode', 'Status', 'Instructions', 'Manage']}
            rows={(rows as PaymentMethodRow[]).map((method) => {
              const config = fromJsonObject<Record<string, unknown>>(method.config);
              const mode = String(config.mode || (config.providerType === 'offline' ? 'offline' : 'gateway'));
              return [
                <span key="name" className="font-bold text-white">{method.name}</span>,
                <code key="slug" className="text-xs font-bold text-[#1D9BF0]">{method.slug}</code>,
                <Badge key="mode" tone={mode === 'offline' ? 'blue' : 'slate'}>{mode === 'offline' ? 'Offline/manual' : 'Gateway'}</Badge>,
                <Badge key="active" tone={method.active ? 'green' : 'red'}>{method.active ? 'Active' : 'Disabled'}</Badge>,
                <p key="instructions" className="max-w-xl text-sm leading-6 text-[#71767B]">{method.instructions || 'No customer instructions configured yet.'}</p>,
                <div key="manage" className="grid min-w-80 gap-2">
                  <form className="grid gap-2" action="/api/admin/payment-methods" method="post">
          <CsrfInput />
                    <input type="hidden" name="_action" value="update" />
                    <input type="hidden" name="id" value={method.id} />
                    <label className="grid gap-1 text-xs font-bold text-slate-300">
                      Name shown at checkout
                      <input className="input" name="name" defaultValue={method.name} />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-slate-300">
                      Unique checkout slug
                      <input className="input" name="slug" defaultValue={method.slug} />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-slate-300">
                      Customer payment instructions
                      <textarea className="input min-h-24" name="instructions" defaultValue={method.instructions || ''} />
                      <span className="font-semibold leading-5 text-[#71767B]">
                        Add exact payment steps, reference format, receipt requirements, and approval timing.
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <input type="checkbox" name="active" defaultChecked={method.active} /> Show this method at checkout
                    </label>
                    <button className="btn-secondary w-fit">Update</button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    <form action="/api/admin/payment-methods" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="toggle" />
                      <input type="hidden" name="id" value={method.id} />
                      <button className="btn-secondary">{method.active ? 'Disable' : 'Enable'}</button>
                    </form>
                    <form action="/api/admin/payment-methods" method="post">
          <CsrfInput />
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="id" value={method.id} />
                      <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                    </form>
                  </div>
                </div>
              ];
            })}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
