import { BookOpen, Globe2, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

const points = [
  { title: 'Marketplace ready', description: 'Courses, instructors, checkout, certificates, and learning operations share one product surface.', icon: BookOpen },
  { title: 'Global by default', description: 'Built with multilingual, multi-currency, and marketplace administration workflows in mind.', icon: Globe2 },
  { title: 'Operational control', description: 'Admins get the tools to approve, monitor, support, and grow an education business.', icon: ShieldCheck }
];

export default async function Page() {
  const [page, settings] = await Promise.all([
    prisma.page.findUnique({ where: { slug: 'about' } }).catch(() => null),
    getSiteSettings()
  ]);
  const title = page?.titleEn || `About ${settings.siteName}`;
  const body = page?.bodyEn;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft p-8">
          <h1 className="text-5xl font-black text-white">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            {page?.seoDescription || `${settings.siteName} is a modern education marketplace for course commerce, live learning, instructor operations, and learner dashboards.`}
          </p>
        </div>
        </section>
        {body ? (
          <section className="page-shell mt-8">
            <div className="moe-panel whitespace-pre-wrap p-6 text-sm leading-7 text-slate-100">{body}</div>
          </section>
        ) : (
          <section className="page-shell mt-8 grid gap-6 md:grid-cols-3">
            {points.map(({ title, description, icon: Icon }) => (
              <div className="moe-panel moe-card-shine p-6" key={title}>
                <Icon size={22} className="text-violet-300" />
                <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </div>
            ))}
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
