import Link from 'next/link';
import { InlineGatewayCheckout } from '@/components/checkout/InlineGatewayCheckout';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function InlineGatewayPage(props: {
  params: Promise<{ gateway: string }>;
  searchParams?: Promise<{ orderId?: string }>;
}) {
  const { gateway } = await props.params;
  const searchParams = await props.searchParams;
  const orderId = String(searchParams?.orderId || '').trim();
  const user = await requireUser(['STUDENT', 'ADMIN']).catch(() => null);

  if (!user) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl border border-[#2F3336] bg-[#050505] p-6">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#1D9BF0]">Secure checkout</p>
          <h1 className="mt-2 text-3xl font-black">Sign in to continue payment</h1>
          <p className="mt-3 text-sm leading-6 text-[#71767B]">
            Inline provider widgets are only shown to the student who owns the order.
          </p>
          <Link className="btn-primary mt-5 inline-flex" href={`/login?next=${encodeURIComponent(`/checkout/inline/${gateway}?orderId=${orderId}`)}`}>
            Log in
          </Link>
        </div>
      </main>
    );
  }

  const order = orderId
    ? await prisma.order.findFirst({
        where: { id: orderId, ...(user.role === 'ADMIN' ? {} : { userId: user.id }) },
        include: { payment: true },
      })
    : null;

  const metadata = fromJsonObject<Record<string, any>>(order?.payment?.metadata);
  const payload = fromJsonObject<Record<string, any>>(metadata.gatewayPayload);
  const successUrl = String(metadata.successUrl || `/payment/success?orderId=${order?.id || ''}&gateway=${gateway}`);
  const cancelUrl = String(metadata.cancelUrl || `/payment/cancel?orderId=${order?.id || ''}&gateway=${gateway}`);
  const expectedGateway = String(order?.gateway || order?.payment?.gateway || '').toLowerCase();
  const validGateway = expectedGateway === gateway.toLowerCase();
  const inlineReady = Boolean(order && validGateway && metadata.inlineCheckout && Object.keys(payload).length);

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-bold text-[#1D9BF0] hover:text-white" href="/cart">
          Back to cart
        </Link>
        <section className="mt-6 border border-[#2F3336] bg-[#050505] p-6">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#1D9BF0]">Secure checkout</p>
          <h1 className="mt-2 text-3xl font-black">Complete {gateway} payment</h1>
          <p className="mt-3 text-sm leading-6 text-[#71767B]">
            This page renders the provider checkout widget created for your order. Payment status is confirmed by the provider webhook or success callback.
          </p>
        </section>

        <section className="mt-5 border border-[#2F3336] bg-[#050505] p-6">
          {inlineReady ? (
            <InlineGatewayCheckout gateway={gateway.toLowerCase()} payload={payload} successUrl={successUrl} cancelUrl={cancelUrl} />
          ) : (
            <div>
              <p className="font-bold">Inline checkout session is not available for this order.</p>
              <p className="mt-2 text-sm text-[#71767B]">Create a new checkout session or verify that the selected gateway is active and configured.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
