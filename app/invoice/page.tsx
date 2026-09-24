import { EmptyState } from '@/components/EmptyState';
import { Footer } from '@/components/Footer';
import { InvoicePrintButton } from '@/components/InvoicePrintButton';
import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CalendarDays, FileText, ShieldAlert } from 'lucide-react';

const money = (value: unknown, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));

function renderTemplate(html: string, values: Record<string, string>) {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => values[key] || '');
}

function MessagePage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <Nav />
      <main className="moe-page grid min-h-[calc(100vh-180px)] items-center py-12">
        <EmptyState title={title} description={description} action={<a className="moe-primary" href="/student/invoices">View invoices</a>} />
      </main>
      <Footer />
    </>
  );
}

export default async function Invoice(props: { searchParams: Promise<{ id?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const order = searchParams.id
    ? await prisma.order.findUnique({ where: { id: searchParams.id }, include: { items: true } })
    : null;

  if (!order) return <MessagePage title="Invoice not found" description="The invoice link is missing or no longer exists." />;
  if (user.role !== 'ADMIN' && order.userId !== user.id) {
    return <MessagePage title="Access denied" description="This invoice belongs to another account." />;
  }

  const [invoiceTemplate] = await Promise.all([
    prisma.invoiceTemplate.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  const paid = order.status === 'PAID';
  const renderedTemplate = invoiceTemplate ? renderTemplate(invoiceTemplate.html, {
    invoiceNumber: order.invoiceNumber,
    status: order.status,
    total: money(order.total, order.currency),
    currency: order.currency,
    gateway: order.gateway,
    createdAt: order.createdAt.toLocaleDateString(),
  }) : '';

  return (
    <>
      <Nav />
      <main className="moe-page py-10">
        <section className="moe-panel mx-auto max-w-4xl overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-300/15 p-6 md:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Invoice</p>
              <h1 className="mt-2 text-4xl font-black text-white">#{order.invoiceNumber}</h1>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} />
                  {order.createdAt.toLocaleDateString()}
                </span>
                <span className="inline-flex items-center gap-2">
                  <FileText size={16} />
                  {order.gateway}
                </span>
              </div>
            </div>
            <span
              className={`rounded-lg px-3 py-1.5 text-sm font-black ${
                paid
                  ? 'border border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
                  : 'border border-amber-300/25 bg-amber-400/10 text-amber-200'
              }`}
            >
              {order.status}
            </span>
          </div>

          <div className="p-6 md:p-8">
            <div className="overflow-hidden rounded-md border border-violet-300/15">
              {order.items.map((item) => (
                <div className="flex items-center justify-between gap-4 border-b border-violet-300/15 p-4 last:border-0" key={item.id}>
                  <span className="font-semibold text-slate-100">{item.title}</span>
                  <b className="text-white">{money(item.price, order.currency)}</b>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-violet-300/15 bg-white/[0.04] p-5">
              <span className="text-lg font-black text-white">Total</span>
              <span className="text-3xl font-black text-white">{money(order.total, order.currency)}</span>
            </div>
            {renderedTemplate ? (
              <div className="mt-6 rounded-md border border-violet-300/15 bg-black/20 p-5 text-sm leading-6 text-slate-200" dangerouslySetInnerHTML={{ __html: renderedTemplate }} />
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-violet-300/15 bg-black/20 p-4 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2 font-bold">
                <ShieldAlert size={18} />
                Payments are confirmed by the configured provider or admin approval.
              </span>
              <InvoicePrintButton />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
