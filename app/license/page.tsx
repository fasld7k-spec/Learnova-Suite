import { BadgeCheck, GitFork, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { AUTHOR_NAME, AUTHOR_URL } from '@/lib/constants';

const licensePoints = [
  {
    title: 'Free to use, including commercially',
    description: 'You can run Learnova Suite for your own academy or for clients, with no license fees or installation limits.',
    icon: BadgeCheck
  },
  {
    title: 'Modify and redistribute',
    description: 'You can change the source code and share or publish your modified version under the terms of the Apache License 2.0.',
    icon: GitFork
  },
  {
    title: 'Keep the attribution',
    description: 'Redistributions must keep the LICENSE and NOTICE files, including the copyright and author attribution.',
    icon: ShieldCheck
  }
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
              Learnova Suite is free and open-source software released under the Apache License 2.0. Copyright © 2026{' '}
              <a className="font-bold text-violet-300 hover:underline" href={AUTHOR_URL} rel="noopener" target="_blank">
                {AUTHOR_NAME}
              </a>
              .
            </p>
          </div>
        </section>

        <section className="page-shell mt-8 grid gap-5 md:grid-cols-3">
          {licensePoints.map(({ title, description, icon: Icon }) => (
            <div className="moe-panel moe-card-shine p-5" key={title}>
              <span className="moe-mini-icon">
                <Icon size={21} />
              </span>
              <h2 className="mt-5 text-xl font-black text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
