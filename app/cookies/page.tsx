import { Cookie, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { CookieCategoryConsentButton } from '@/components/CookieCategoryConsentButton';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export const dynamic = 'force-dynamic';

const fallbackCategories = [
  { id: 'required', key: 'required', name: 'Required cookies', description: 'Needed for login, checkout, security, session routing, and core marketplace features.', required: true },
  { id: 'analytics', key: 'analytics', name: 'Analytics cookies', description: 'Help measure page views, enrollment funnels, and course discovery performance.', required: false },
  { id: 'preferences', key: 'preferences', name: 'Preference cookies', description: 'Remember language, display, consent, and learner experience preferences.', required: false }
];

async function getCookieCategories() {
  try {
    const categories = await prisma.cookieCategory.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
    return categories.length ? categories : fallbackCategories;
  } catch {
    return fallbackCategories;
  }
}

export default async function Cookies() {
  const [categories, page] = await Promise.all([
    getCookieCategories(),
    prisma.page.findUnique({ where: { slug: 'cookies' } }).catch(() => null)
  ]);
  const settings = await getSiteSettings();

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft grid gap-6 p-6 md:p-8 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <span className="moe-mini-icon h-12 w-12">
              <Cookie size={23} />
            </span>
            <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl">{page?.titleEn || 'Cookie Preferences'}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              {page?.seoDescription || `Manage the cookie categories used by ${settings.siteName} for authentication, consent, analytics, and platform preferences.`}
            </p>
          </div>
          <div className="grid content-center gap-3 rounded-md border border-violet-300/15 bg-black/20 p-5 text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <ShieldCheck size={19} className="text-violet-200" />
              Required cookies stay enabled for security.
            </div>
            <div className="flex items-center gap-3">
              <SlidersHorizontal size={19} className="text-violet-200" />
              Optional choices are recorded in the consent log immediately.
            </div>
          </div>
          </div>
        </section>

        {page?.bodyEn ? (
          <section className="page-shell mt-8">
            <div className="moe-panel whitespace-pre-wrap p-6 text-sm leading-7 text-slate-200">{page.bodyEn}</div>
          </section>
        ) : (
          <div className="page-shell mt-8 grid gap-4 md:grid-cols-3">
            {categories.map((category) => (
              <div className="moe-panel moe-card-shine p-6" key={category.id}>
                <span className="moe-mini-icon">
                  <Cookie size={22} />
                </span>
                <h2 className="mt-5 text-xl font-black text-white">{category.name}</h2>
                <p className="mt-3 min-h-24 text-sm leading-6 text-slate-300">{category.description}</p>
                <CookieCategoryConsentButton categoryId={category.key} required={category.required} />
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
