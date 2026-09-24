import { ExternalLink, FolderKanban } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { prisma } from '@/lib/prisma';

export default async function PublicPortfolio(props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const projects = await prisma.portfolioProject.findMany({ where: { userId: params.userId, public: true }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <section className="page-shell">
          <div className="moe-panel-soft p-6 md:p-8">
            <span className="moe-mini-icon h-12 w-12">
              <FolderKanban size={23} />
            </span>
            <h1 className="mt-5 text-5xl font-black text-white">Portfolio</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Public learner work, capstone projects, and course outcomes displayed in a marketplace-ready layout.
            </p>
          </div>
        </section>

        <section className="page-shell mt-8 grid gap-6 md:grid-cols-2">
          {projects.length ? projects.map((project) => project.url ? (
            <a className="moe-panel moe-card-shine block p-5 transition hover:-translate-y-0.5" key={project.id} href={project.url}>
              <span className="moe-mini-icon">
                <ExternalLink size={21} />
              </span>
              <h2 className="mt-5 text-xl font-black text-white">{project.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{project.description}</p>
            </a>
          ) : (
            <article className="moe-panel block p-5" key={project.id}>
              <span className="moe-mini-icon">
                <FolderKanban size={21} />
              </span>
              <h2 className="mt-5 text-xl font-black text-white">{project.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{project.description}</p>
              <p className="mt-5 text-sm font-bold text-slate-400">Public project link not added yet.</p>
            </article>
          )) : (
            <div className="moe-panel p-6 text-center md:col-span-2">
              <span className="moe-mini-icon mx-auto">
                <FolderKanban size={22} />
              </span>
              <h2 className="mt-4 text-2xl font-black text-white">No public portfolio projects yet</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                This learner has not published any portfolio projects for public viewing.
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
