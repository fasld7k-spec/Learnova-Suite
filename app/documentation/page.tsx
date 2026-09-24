import Link from 'next/link';
import { BookOpenCheck, CloudCog, Database, FileText, KeyRound, LifeBuoy, Rocket, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';

const guides = [
  {
    title: 'Quick install',
    description: 'Install dependencies, configure environment variables, run Prisma, seed local evaluation data and start Learnova Suite.',
    href: '/install-check',
    icon: Rocket
  },
  {
    title: 'Demo credentials',
    description: 'Review the prepared Admin, Instructor and Student accounts used for CodeCanyon evaluation.',
    href: '/demo',
    icon: KeyRound
  },
  {
    title: 'Production readiness',
    description: 'Switch off demo mode, configure HTTPS, SMTP, object storage, real payments and strong secrets.',
    href: '/admin/release-checklist',
    icon: ShieldCheck
  },
  {
    title: 'Payment setup',
    description: 'Configure native and hosted gateway settings, sandbox checks and webhook validation before going live.',
    href: '/admin/payment-gateways',
    icon: CloudCog
  },
  {
    title: 'Database and backups',
    description: 'Use Prisma migrations, seed data, PostgreSQL deployment notes and the admin backup readiness workflow.',
    href: '/admin/backups',
    icon: Database
  },
  {
    title: 'Support policy',
    description: 'Understand included support, buyer responsibilities and production deployment boundaries.',
    href: '/support',
    icon: LifeBuoy
  }
];

const includedDocs = [
  'docs/COMPLETE_PLATFORM_MANUAL.md',
  'docs/QUICK_INSTALL.md',
  'docs/RUN_AND_DEPLOY_STEPS.md',
  'docs/BUYER_DOCUMENTATION.md',
  'docs/PRODUCTION_READINESS.md',
  'docs/PAYMENT_GATEWAYS.md',
  'docs/ASSET_LICENSES.md',
  'docs/THIRD_PARTY_NOTICES.md'
];

export default function DocumentationPage() {
  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-violet-300/15 p-8 lg:border-b-0 lg:border-r">
            <span className="moe-mini-icon h-12 w-12">
              <BookOpenCheck size={23} strokeWidth={1.8} />
            </span>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-violet-300">Public documentation</p>
            <h1 className="mt-2 max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl">
              Learnova Suite buyer guide
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Use this online index with the hosted demo, then open the full Markdown documentation included inside the buyer package.
            </p>
          </div>
          <div className="grid content-center gap-3 bg-white/[0.03] p-8">
            {includedDocs.slice(0, 5).map((doc) => (
              <div className="moe-panel flex items-center gap-3 p-3" key={doc}>
                <FileText className="shrink-0 text-violet-300" size={17} strokeWidth={1.8} />
                <code className="break-all text-xs font-bold text-[#D7DEE4]">{doc}</code>
              </div>
            ))}
          </div>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Link className="moe-panel moe-card-shine p-5 transition hover:-translate-y-0.5" href={guide.href} key={guide.title}>
                <Icon className="text-violet-300" size={24} strokeWidth={1.8} />
                <h2 className="mt-4 text-xl font-black text-white">{guide.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{guide.description}</p>
              </Link>
            );
          })}
        </section>

        <section className="page-shell mt-8">
        <div className="moe-panel p-6">
          <h2 className="text-2xl font-black text-white">Included buyer documentation</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            The CodeCanyon package includes the complete source code and a documentation archive. These files explain installation, customization, deployment, assets, third-party notices and support scope.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {includedDocs.map((doc) => (
              <div className="rounded-lg border border-violet-300/15 bg-white/[0.04] flex items-center gap-3 p-3" key={doc}>
                <FileText className="shrink-0 text-violet-300" size={17} strokeWidth={1.8} />
                <code className="break-all text-xs font-bold text-[#D7DEE4]">{doc}</code>
              </div>
            ))}
          </div>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
