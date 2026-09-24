import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { BookOpenCheck, GraduationCap, LayoutDashboard, MonitorPlay, ReceiptText, Settings2, UserRoundCog } from 'lucide-react';
import { featureEnabled } from '@/lib/features';

const localEvaluationPassword = process.env.DEMO_PASSWORD || 'Set DEMO_PASSWORD';

const demoAccounts = [
  { role: 'Admin', email: 'admin@demo.com', password: localEvaluationPassword },
  { role: 'Instructor', email: 'instructor@demo.com', password: localEvaluationPassword },
  { role: 'Student', email: 'student@demo.com', password: localEvaluationPassword },
];

const evaluationSteps = [
  {
    title: 'Browse and buy',
    description: 'Start from the marketplace, open a course, add it to cart, and test the sandbox checkout screen.',
    href: '/courses/nextjs-saas-masterclass',
    cta: 'Open course',
    icon: ReceiptText,
  },
  {
    title: 'Student learning',
    description: 'Sign in as the student to inspect enrolled courses, lessons, progress, certificates and notifications.',
    href: '/student',
    cta: 'Student area',
    icon: GraduationCap,
  },
  {
    title: 'Instructor studio',
    description: 'Sign in as the instructor to review course management, lessons, live sessions, coupons and analytics.',
    href: '/instructor',
    cta: 'Instructor area',
    icon: BookOpenCheck,
  },
  {
    title: 'Admin control',
    description: 'Sign in as the admin to review settings, courses, orders, gateways, themes, languages and release checks.',
    href: '/admin',
    cta: 'Admin area',
    icon: UserRoundCog,
  },
];

const adminChecks = [
  { label: 'Install check', href: '/install-check', icon: Settings2 },
  { label: 'Public documentation', href: '/documentation', icon: BookOpenCheck },
  { label: 'Release checklist', href: '/admin/release-checklist', icon: LayoutDashboard },
  { label: 'Gateway manager', href: '/admin/payment-gateways', icon: ReceiptText },
];

export default async function Demo() {
  if (process.env.DEMO_MODE !== 'true') notFound();
  if (await featureEnabled('public_demo_disabled')) notFound();

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
              <div>
                <span className="moe-mini-icon h-12 w-12">
                  <MonitorPlay size={23} />
                </span>
                <h1 className="mt-5 max-w-3xl text-4xl font-black text-white md:text-5xl">
                  Explore Learnova Suite through the strongest product flows.
                </h1>
                <p className="mt-4 max-w-2xl leading-7 text-slate-300">
                  Use the guided links below to test the marketplace, learner experience, instructor studio and admin control center with safe local-evaluation credentials.
                </p>
              </div>
              <div className="rounded-md border border-violet-300/15 bg-black/20 p-5">
                <MonitorPlay className="text-violet-200" size={28} />
                <p className="mt-4 text-2xl font-black text-white">Demo enabled</p>
                <p className="mt-1 text-sm text-slate-300">Use these accounts for QA and presentations.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="page-shell mt-8 grid gap-4 md:grid-cols-3">
          {demoAccounts.map((account) => (
            <div className="moe-panel moe-card-shine p-5" key={account.role}>
              <h2 className="text-xl font-black text-white">{account.role}</h2>
              <p className="mt-4 font-mono text-sm text-violet-100">{account.email}</p>
              <p className="mt-2 font-mono text-sm text-slate-300">{account.password}</p>
            </div>
          ))}
        </div>

        <section className="page-shell mt-12">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">Evaluation path</p>
              <h2 className="text-3xl font-black text-white">Suggested QA journey</h2>
            </div>
            <a className="moe-primary w-fit" href="/courses">
              Browse marketplace
            </a>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {evaluationSteps.map((step) => {
              const Icon = step.icon;
              return (
                <a className="moe-panel moe-card-shine block p-5 transition hover:-translate-y-0.5" href={step.href} key={step.title}>
                  <span className="moe-mini-icon">
                    <Icon size={24} />
                  </span>
                  <h3 className="mt-4 text-xl font-black text-white">{step.title}</h3>
                  <p className="mt-2 min-h-16 text-sm leading-6 text-slate-300">{step.description}</p>
                  <span className="mt-5 inline-flex text-sm font-black text-violet-200">{step.cta}</span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="page-shell mt-12">
          <h2 className="text-3xl font-black text-white">Fast checks for buyers and evaluators</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {adminChecks.map((item) => {
              const Icon = item.icon;
              return (
                <a className="moe-panel flex items-center gap-4 p-5 transition hover:border-violet-300/40" href={item.href} key={item.label}>
                  <span className="moe-mini-icon shrink-0">
                    <Icon size={22} />
                  </span>
                  <span className="font-black text-white">{item.label}</span>
                </a>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
