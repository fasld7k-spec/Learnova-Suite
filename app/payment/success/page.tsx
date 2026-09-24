import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { getSession } from '@/lib/auth';
import { localizedPageCopy } from '@/lib/page-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';
import { CheckCircle2, Clock3, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PaymentSuccess(
  props: { searchParams: Promise<{ orderId?: string; reference?: string; gateway?: string }> }
) {
  const searchParams = await props.searchParams;
  const [session, settings] = await Promise.all([getSession(), getSiteSettings()]);
  const copy = localizedPageCopy(settings.defaultLanguage).payment;
  const order = searchParams.orderId && session
    ? await prisma.order.findFirst({ where: { id: searchParams.orderId, ...(session.role === 'ADMIN' ? {} : { userId: session.id }) } })
    : null;
  const paid = order?.status === 'PAID';
  const signedOut = !session;

  return (
    <>
      <Nav />
      <main className="moe-page grid min-h-[calc(100vh-180px)] items-center py-12">
        <section className="page-shell w-full">
        <div className="moe-panel-soft mx-auto max-w-2xl p-8 text-center">
          <div
            className={`mx-auto grid h-16 w-16 place-items-center rounded-full border bg-[#101317] ${
              paid ? 'border-[#00BA7C]/50 text-[#5EE4B3]' : 'border-[#FFD400]/50 text-[#FFE36E]'
            }`}
          >
            {paid ? <CheckCircle2 size={30} /> : <Clock3 size={30} />}
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-violet-300">{paid ? copy.confirmed : signedOut ? copy.signInRequired : copy.pending}</p>
          <h1 className="mt-3 text-4xl font-black text-white">
            {paid ? copy.enrollmentActive : signedOut ? copy.signInStatus : copy.waiting}
          </h1>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-300">
            {signedOut
              ? copy.privateStatus
              : paid
              ? copy.accessReady
              : copy.accessPending}
          </p>
          {order && (
            <div className="mt-6 rounded-lg border border-violet-300/15 bg-white/[0.04] p-4 text-left">
              <p className="text-xs font-bold uppercase text-slate-400">{copy.invoice}</p>
              <p className="mt-1 font-black">{order.invoiceNumber}</p>
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a className="moe-primary px-5 py-3" href={signedOut ? '/login' : paid ? '/student/courses' : '/student/invoices'}>
              {signedOut ? copy.login : paid ? copy.myCourses : copy.viewInvoices}
            </a>
            {order && (
              <a className="moe-control inline-flex h-11 items-center gap-2 px-5 text-sm font-bold text-white" href={`/invoice?id=${order.id}`}>
                <FileText size={17} />
                {copy.openInvoice}
              </a>
            )}
          </div>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
