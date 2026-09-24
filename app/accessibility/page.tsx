import { Keyboard, MonitorSmartphone, Palette } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

const accessibilityItems = [
  { title: 'Keyboard-friendly', body: 'Navigation, buttons, forms, and dashboard controls are designed to remain reachable without a mouse.', icon: Keyboard },
  { title: 'Responsive layouts', body: 'Public pages and workspace shells are structured to work across desktop, tablet, and mobile widths.', icon: MonitorSmartphone },
  { title: 'Readable contrast', body: 'The refreshed design system uses clear foreground, surface, border, and focus treatments.', icon: Palette }
];

export default async function Accessibility() {
  const [page, settings] = await Promise.all([
    prisma.page.findUnique({ where: { slug: 'accessibility' } }).catch(() => null),
    getSiteSettings()
  ]);
  const body = page?.bodyEn;

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
          <h1 className="text-5xl font-black text-white">{page?.titleEn || 'Accessibility Statement'}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            {page?.seoDescription || `${settings.siteName} is designed with semantic HTML, keyboard-friendly controls, responsive layouts, and accessible color contrast.`}
          </p>
          </div>
        </section>
        {body ? (
          <section className="page-shell mt-8">
            <div className="moe-panel whitespace-pre-wrap p-6 text-sm leading-7 text-slate-200">{body}</div>
          </section>
        ) : (
          <div className="page-shell mt-8 grid gap-6 md:grid-cols-3">
            {accessibilityItems.map(({ title, body, icon: Icon }) => (
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
