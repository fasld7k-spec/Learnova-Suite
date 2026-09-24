import { Database, EyeOff, LockKeyhole } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

const sections = [
  { title: 'Data handling', body: 'We collect account, learning, checkout, device, and support data needed to run the marketplace and keep records accurate.', icon: Database },
  { title: 'Access control', body: 'Role-based dashboards help keep admin, instructor, and student workflows separated by responsibility.', icon: LockKeyhole },
  { title: 'Privacy operations', body: 'Export, deletion, consent, retention, and privacy request workflows should be configured for your operating region.', icon: EyeOff }
];

export default async function Page() {
  const [page, settings] = await Promise.all([
    prisma.page.findUnique({ where: { slug: 'privacy' } }).catch(() => null),
    getSiteSettings()
  ]);
  const body = page?.bodyEn;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
          <span className="moe-mini-icon h-12 w-12">
            <LockKeyhole size={23} />
          </span>
          <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl">{page?.titleEn || 'Privacy Policy'}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            {page?.seoDescription || `This policy explains how ${settings.siteName} handles learner, instructor, order, course activity, and support information.`}
          </p>
          </div>
        </section>
        {body ? (
          <section className="page-shell mt-8">
            <div className="moe-panel whitespace-pre-wrap p-6 text-sm leading-7 text-slate-200">{body}</div>
          </section>
        ) : (
          <>
            <div className="page-shell mt-8 grid gap-6 md:grid-cols-3">
              {sections.map(({ title, body, icon: Icon }) => (
                <div className="moe-panel moe-card-shine p-6" key={title}>
                  <span className="moe-mini-icon">
                    <Icon size={22} />
                  </span>
                  <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
                </div>
              ))}
            </div>
            <section className="page-shell mt-8">
              <div className="moe-panel-soft p-6">
              <h2 className="text-2xl font-black text-white">Your choices</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Users may request access, correction, export, deletion, or consent changes from the account and privacy tools configured by the site administrator.
              </p>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
