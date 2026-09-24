import { ArrowRight, Banknote, FileWarning, ReceiptText } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CsrfInput } from '@/components/CsrfInput';
import { formatMoney } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

function MessagePage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft mx-auto max-w-2xl p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#5A4518] bg-[#201A0C] text-[#FFD166]">
            <FileWarning size={23} />
          </div>
          <h1 className="mt-5 text-3xl font-black">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default async function ManualCheckout(props: { searchParams: Promise<{ orderId?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const order = searchParams.orderId ? await prisma.order.findUnique({ where: { id: searchParams.orderId }, include: { payment: true } }) : null;
  if (!order) return <MessagePage title="Order not found" description="We could not find the order for this manual payment page." />;
  if (user.role !== 'ADMIN' && order.userId !== user.id) return <MessagePage title="Forbidden" description="You do not have permission to view payment instructions for this order." />;
  const method = await prisma.paymentMethod.findUnique({ where: { slug: order.gateway } }).catch(() => null);

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft mx-auto grid max-w-6xl overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
          <section className="border-b border-violet-300/15 bg-white/[0.03] p-8 text-white lg:border-b-0 lg:border-r">
            <div className="moe-panel flex h-full min-h-80 flex-col justify-between p-6">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-bold text-violet-300">
                  <ReceiptText size={16} />
                  Invoice {order.invoiceNumber}
                </p>
                <h1 className="mt-4 text-4xl font-black leading-tight">Offline Payment Instructions</h1>
                <p className="mt-4 text-base leading-7 text-slate-300">Transfer the total amount using the configured payment method, then submit your reference for admin review.</p>
              </div>
              <div className="mt-8 rounded-lg border border-violet-300/15 bg-white/[0.04] p-4">
                <p className="text-sm font-bold text-slate-400">Total due</p>
                <b className="mt-2 block text-4xl font-black">{formatMoney(order.total, order.currency)}</b>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="moe-panel p-4">
              <p className="inline-flex items-center gap-2 text-sm font-black text-white">
                <Banknote size={17} />
                Transfer details
              </p>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{method?.instructions || 'Transfer the amount to the configured bank account and contact administrator with receipt.'}</pre>
            </div>
            <form className="mt-6 grid gap-3" action="/api/payments/offline/submit" method="post">
              <CsrfInput />
              <input type="hidden" name="orderId" value={order.id} />
              <input className="input" name="reference" placeholder="Bank/reference number" />
              <textarea className="input min-h-32" name="note" placeholder="Additional note / receipt URL" />
              <button className="moe-primary px-5 py-3">
                Submit Payment Reference
                <ArrowRight size={17} />
              </button>
            </form>
          </section>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
