import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react';

export default async function PaymentCancel(
  props: { searchParams: Promise<{ orderId?: string; gateway?: string; reason?: string }> }
) {
  const searchParams = await props.searchParams;
  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).payment;
  const reason = searchParams.reason || (searchParams.gateway ? `${searchParams.gateway} ${copy.gatewayCancelReason}` : copy.defaultCancelReason);

  return (
    <>
      <Nav />
      <main className="moe-page grid min-h-[calc(100vh-180px)] items-center py-12">
        <section className="page-shell w-full">
        <div className="moe-panel-soft mx-auto max-w-2xl p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#4C1D1D] bg-[#1C1010] text-[#FF6B6B]">
            <XCircle size={30} />
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-violet-300">{copy.cancelled}</p>
          <h1 className="mt-3 text-4xl font-black text-white">{copy.noCharge}</h1>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-300">{reason}</p>
          {searchParams.orderId && (
            <div className="mx-auto mt-5 max-w-lg rounded-lg border border-violet-300/15 bg-white/[0.04] p-3 text-left text-sm">
              <span className="font-bold text-white">{copy.orderId}</span>
              <code className="mt-1 block break-all text-slate-400">{searchParams.orderId}</code>
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a className="moe-primary px-5 py-3" href="/cart">
              <RotateCcw size={17} />
              {copy.retry}
            </a>
            <a className="moe-control inline-flex h-11 items-center gap-2 px-5 text-sm font-bold text-white" href="/courses">
              <ArrowLeft size={17} />
              {copy.browse}
            </a>
            <a className="moe-control inline-flex h-11 items-center px-5 text-sm font-bold text-white" href="/contact">
              {copy.support}
            </a>
          </div>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
