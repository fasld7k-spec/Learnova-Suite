import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { GitBranch, Rocket } from 'lucide-react';

const releases = [
  {
    version: '1.0.0',
    title: 'Marketplace-ready LMS release',
    body:
      'Initial release with course marketplace flows, student/instructor/admin dashboards, course builder, live classes, Stripe and PayPal production adapters, offline payments, certificates, subscriptions, quizzes, bundles, CMS, SEO, storage, email, and documentation.',
  },
];

export default function Changelog() {
  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <GitBranch size={23} />
            </span>
          <h1 className="mt-5 text-5xl font-black text-white">Changelog</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Release updates, production readiness notes, and platform improvements.
          </p>
          </div>
        </section>

        <div className="page-shell mt-8 grid gap-5">
          {releases.map((release) => (
            <article className="moe-panel moe-card-shine p-5" key={release.version}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="inline-flex items-center gap-2 text-2xl font-black text-white">
                  <Rocket size={21} className="text-violet-200" />
                  {release.version}
                </h2>
                <p className="text-sm font-bold text-violet-200">{release.title}</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{release.body}</p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
