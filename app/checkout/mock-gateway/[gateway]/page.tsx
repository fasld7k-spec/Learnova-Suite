import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { gatewayLabels, isMockPaymentEnabled } from '@/lib/payment-gateways';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/site-settings';
import { AlertTriangle, CheckCircle2, CreditCard, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MockGateway(
  props: {
    params: Promise<{ gateway: string }>;
    searchParams: Promise<{ orderId?: string; reference?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const order = searchParams.orderId ? await prisma.order.findUnique({ where: { id: searchParams.orderId } }) : null;
  const gatewayName = gatewayLabels[params.gateway] || params.gateway;
  const sandboxEnabled = isMockPaymentEnabled();

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft mx-auto max-w-3xl overflow-hidden">
          <div className="border-b border-violet-300/15 p-6 text-center md:p-8">
            <div className="moe-mini-icon mx-auto h-14 w-14">
              <CreditCard size={25} />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-violet-300">Secure test checkout</p>
            <h1 className="mt-3 text-4xl font-black text-white">{gatewayName} Checkout</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300">
              Complete this order in test mode. When live provider credentials are configured, buyers are routed to the provider-hosted checkout.
            </p>
          </div>

          <div className="p-6 md:p-8">
            <div className="rounded-[8px] border border-[#FFD400]/40 bg-[#FFD400]/10 p-4 text-sm leading-6 text-white">
              <span className="inline-flex items-center gap-2 font-bold">
                <AlertTriangle className="text-[#FFD400]" size={18} />
                {sandboxEnabled ? 'Test mode is active. Turn it off before accepting live payments.' : 'Test payments are disabled for this installation.'}
              </span>
            </div>

            {order ? (
              <div className="moe-panel mt-6 grid gap-4 p-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-400">Invoice</span>
                  <b>{order.invoiceNumber}</b>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-400">Amount</span>
                  <b className="text-2xl">{formatMoney(order.total, order.currency)}</b>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-400">Reference</span>
                  <code className="break-all rounded border border-violet-300/15 bg-black/30 px-2 py-1 text-xs">{searchParams.reference || 'test-reference'}</code>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-violet-300/15 p-5 text-center">
                <p className="font-bold">Order not found</p>
                <p className="mt-1 text-sm text-slate-400">Return to checkout and create a new order.</p>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <form action="/api/payments/mock/success" method="post">
                <CsrfInput />
                <input type="hidden" name="orderId" value={searchParams.orderId || ''} />
                <input type="hidden" name="gateway" value={params.gateway} />
                <input type="hidden" name="reference" value={searchParams.reference || ''} />
                <button className={`moe-primary w-full justify-center px-5 py-3 ${order && sandboxEnabled ? '' : 'pointer-events-none opacity-50'}`} disabled={!order || !sandboxEnabled}>
                  <CheckCircle2 size={18} />
                  Confirm Test Payment
                </button>
              </form>
              <a className="moe-control inline-flex h-12 items-center justify-center gap-2 px-5 text-sm font-bold text-white" href={`/payment/cancel?orderId=${searchParams.orderId || ''}&gateway=${params.gateway}`}>
                <XCircle size={18} />
                Cancel Payment
              </a>
            </div>
          </div>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
