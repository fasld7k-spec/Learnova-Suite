import { CreditCard } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { localizedPageCopy } from '@/lib/page-copy';
import { getSiteSettings } from '@/lib/site-settings';

export default async function Page() {
  const settings = await getSiteSettings();
  const copy = localizedPageCopy(settings.defaultLanguage).checkout;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft mx-auto max-w-4xl p-8">
          <span className="moe-mini-icon h-14 w-14">
            <CreditCard size={28} />
          </span>
          <h1 className="mt-6 text-4xl font-black text-white">{copy.title}</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-300">
            {copy.body}
          </p>
          <a className="moe-primary mt-8 px-5 py-3" href="/cart">
            {copy.openCart}
          </a>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
