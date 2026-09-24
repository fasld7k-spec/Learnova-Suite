import { ArrowRight, BriefcaseBusiness, CheckCircle2 } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function CareerDetail(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const track = await prisma.careerTrack.findUnique({ where: { slug: params.slug } });
  if (!track || !track.active) notFound();
  const skills = fromJsonArray<string>(track.skillIds);

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="moe-panel-soft p-6 md:p-8">
          <div>
            <span className="moe-mini-icon h-12 w-12">
              <BriefcaseBusiness size={23} />
            </span>
            <h1 className="mt-5 text-5xl font-black text-white">{track.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{track.description}</p>
          </div>
          </div>
          <form action="/api/careers/enroll" method="post" className="moe-panel h-fit p-5">
            <CsrfInput />
            <input type="hidden" name="careerTrackId" value={track.id} />
            <p className="text-sm font-bold text-slate-300">Skills covered</p>
            <b className="mt-2 block text-4xl font-black text-white">{skills.length}</b>
            <button className="moe-primary mt-5 w-full">
              Enroll in Career Track
              <ArrowRight size={17} />
            </button>
          </form>
        </section>

        <section className="page-shell mt-8">
          <div className="moe-panel p-6">
          <h2 className="text-2xl font-black text-white">Skills covered</h2>
          {skills.length ? (
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {skills.map((skill) => (
                <li key={skill} className="flex items-center gap-3 text-sm font-semibold text-slate-200">
                  <CheckCircle2 size={18} className="text-emerald-300" />
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5">
              <EmptyState title="No skills listed" description="Skills will appear here when the career track is configured." />
            </div>
          )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
