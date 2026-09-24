import { FileCheck2, Handshake, ReceiptText } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

const items = [
  { title: 'Marketplace terms', body: 'Learners are responsible for account accuracy, course enrollment choices, checkout details, and following course conduct rules.', icon: ReceiptText },
  { title: 'Instructor terms', body: 'Instructors must own or license their content, maintain course quality, and follow payout and moderation requirements.', icon: Handshake },
  { title: 'Platform rules', body: 'Acceptable use, refunds, certificates, live sessions, comments, reviews, and account security are governed by these terms.', icon: FileCheck2 }
];

export default async function Page() {
  const page = await prisma.page.findUnique({ where: { slug: 'terms' } }).catch(() => null);
  const body = page?.bodyEn;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
          <span className="moe-mini-icon h-12 w-12">
            <FileCheck2 size={23} />
          </span>
          <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl">{page?.titleEn || 'Terms and Conditions'}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            {page?.seoDescription || 'These terms cover buyer access, instructor participation, subscriptions, support, moderation, and marketplace operations.'}
          </p>
          </div>
        </section>
        {body ? (
          <section className="page-shell mt-8">
            <div className="moe-panel whitespace-pre-wrap p-6 text-sm leading-7 text-slate-200">{body}</div>
          </section>
        ) : (
          <div className="page-shell mt-8 grid gap-6 md:grid-cols-3">
            {items.map(({ title, body, icon: Icon }) => (
              <div className="moe-panel moe-card-shine p-6" key={title}>
                <span className="moe-mini-icon">
                  <Icon size={22} />
                </span>
                <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
