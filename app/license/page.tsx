import { BadgeCheck, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';

const licensePoints = [
  { title: 'One installation per regular license', icon: BadgeCheck },
  { title: 'Customization allowed for buyer projects', icon: ShieldCheck },
  { title: 'Source redistribution requires extended rights', icon: LockKeyhole }
];

export default function License() {
  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <ShieldCheck size={23} />
            </span>
            <h1 className="mt-5 text-5xl font-black text-white">License</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Learnova Suite is prepared for commercial marketplace sale with clear buyer usage terms and installation guidance.
            </p>
          </div>
        </section>

        <section className="page-shell mt-8 grid gap-5 md:grid-cols-3">
          {licensePoints.map(({ title, icon: Icon }) => (
            <div className="moe-panel moe-card-shine p-5" key={title}>
              <span className="moe-mini-icon">
                <Icon size={21} />
              </span>
              <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Buyers should follow the license terms included with the purchase package and marketplace policy.
              </p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
