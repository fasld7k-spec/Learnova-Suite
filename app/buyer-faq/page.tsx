import { CircleHelp } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';

const faqs = [
  [
    'Is this ready for CodeCanyon?',
    'Yes. The project includes source code, seed data, buyer documentation, install steps, build validation, and marketplace-safe defaults.',
  ],
  [
    'Does it include real payment gateways?',
    'It includes demo checkout, offline/manual payment flows, and Stripe/PayPal production foundations. Buyers should configure provider credentials and complete gateway sandbox QA before accepting live payments.',
  ],
  [
    'Can I customize branding?',
    'Yes. Admin settings, CMS pages, navigation, SEO metadata, public copy, and global UI tokens can be customized for a white-label marketplace.',
  ],
  [
    'Does it support Arabic?',
    'Yes. The interface is RTL/LTR ready, with Arabic-ready settings and content fields for localized course marketplaces.',
  ],
];

export default function BuyerFaq() {
  return (
    <>
      <Nav />
      <main className="moe-page py-12 text-white">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
          <span className="moe-mini-icon h-12 w-12">
            <CircleHelp size={23} />
          </span>
          <h1 className="mt-5 text-5xl font-black">Buyer FAQ</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Common product, marketplace, payment, localization, and deployment questions for marketplace buyers.
          </p>
          </div>
        </section>

        <div className="page-shell mt-8 grid gap-4">
          {faqs.map(([question, answer]) => (
            <article className="moe-panel moe-card-shine flex gap-4 p-5" key={question}>
              <span className="moe-mini-icon mt-1 shrink-0">
                <CircleHelp size={20} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-xl font-black">{question}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{answer}</p>
              </div>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
