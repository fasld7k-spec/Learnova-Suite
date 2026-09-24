import Link from 'next/link';
import { ArrowRight, BookOpenCheck, CircleHelp, LifeBuoy, Search } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

const faqs = [
  ['How do I buy a course?', 'Create an account, open a course, and complete checkout from the course page or cart.'],
  ['How do I become an instructor?', 'Register as an instructor, complete your profile, and wait for admin approval before publishing.'],
  ['How do certificates work?', 'Complete all required lessons to generate a certificate with a public verification code.'],
  ['Where can I track a support request?', 'Use the support desk to submit a ticket and follow the learner-facing ticket flow.']
];

export default function Help() {
  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
        <div className="moe-panel-soft grid overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-violet-300/15 p-8 lg:border-b-0 lg:border-r">
            <span className="moe-mini-icon h-12 w-12">
              <BookOpenCheck size={23} />
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl">Help Center</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Fast answers for learner accounts, instructor onboarding, certificates, checkout, and marketplace support.
            </p>
          </div>
          <div className="grid content-between gap-6 bg-white/[0.03] p-8">
            <form className="relative" action="/knowledge-base">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-11 pr-24" name="q" placeholder="Search help topics" aria-label="Search help topics" />
              <button className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-violet-600 px-4 text-xs font-black text-white transition hover:bg-violet-500" type="submit">
                Search
              </button>
            </form>
            <div className="flex flex-wrap gap-3">
              <Link href="/documentation" className="moe-control inline-flex h-11 items-center px-5 text-sm font-bold text-white">
                Documentation
              </Link>
              <Link href="/support" className="moe-primary w-fit px-5 py-3">
              Open Support
              <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
        </section>

        <section className="page-shell mt-8 grid gap-4 lg:grid-cols-2">
          {faqs.map(([question, answer]) => (
            <div className="moe-panel moe-card-shine p-5 transition hover:-translate-y-0.5" key={question}>
              <div className="flex gap-4">
                <span className="moe-mini-icon h-10 w-10 shrink-0">
                  <CircleHelp size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-black text-white">{question}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{answer}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="page-shell mt-8">
        <div className="moe-panel flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex gap-4">
            <span className="moe-mini-icon h-11 w-11 shrink-0">
              <LifeBuoy size={21} />
            </span>
            <div>
              <h2 className="text-xl font-black text-white">Need a human?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">Send a support ticket with priority, category, and course context.</p>
            </div>
          </div>
          <Link href="/support" className="moe-control inline-flex h-11 items-center px-5 text-sm font-bold text-white">
            Support Desk
          </Link>
        </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
