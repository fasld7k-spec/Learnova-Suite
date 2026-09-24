import { ExternalLink, FolderKanban, Globe2, Lock, Plus } from 'lucide-react';

import { CsrfInput } from '@/components/CsrfInput';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function formatDate(value: Date) {
  return value.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function Portfolio() {
  const user = await requireUser(['STUDENT']);
  const projects = await prisma.portfolioProject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });

  const publicProjects = projects.filter((project) => project.public).length;

  return (
    <DashboardShell role="student" title="Portfolio">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="moe-panel rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="moe-mini-icon"><FolderKanban size={18} /></span>
            <p className="text-sm font-bold text-slate-400">Projects</p>
          </div>
          <p className="mt-4 text-3xl font-black text-white">{projects.length}</p>
        </div>
        <div className="moe-panel rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="moe-mini-icon"><Globe2 size={18} /></span>
            <p className="text-sm font-bold text-slate-400">Public</p>
          </div>
          <p className="mt-4 text-3xl font-black text-white">{publicProjects}</p>
        </div>
        <div className="moe-panel rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="moe-mini-icon"><Lock size={18} /></span>
            <p className="text-sm font-bold text-slate-400">Private</p>
          </div>
          <p className="mt-4 text-3xl font-black text-white">{projects.length - publicProjects}</p>
        </div>
      </div>

      <form className="moe-panel mb-6 grid gap-4 rounded-2xl p-5" action="/api/student/portfolio" method="post">
        <CsrfInput />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-slate-500">Project title</span>
            <input className="input" name="title" placeholder="React analytics dashboard" maxLength={140} required />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-slate-500">Project URL</span>
            <input className="input" name="url" type="url" placeholder="https://example.com" />
          </label>
        </div>
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase text-slate-500">Description</span>
          <textarea className="input min-h-28" name="description" placeholder="What did you build and what skills does it show?" maxLength={600} />
        </label>
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-slate-500">Image URL</span>
            <input className="input" name="imageUrl" type="url" placeholder="https://example.com/preview.png" />
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-violet-300/15 bg-white/[0.03] px-4 text-sm font-bold text-slate-200">
            <input className="h-4 w-4 accent-violet-500" type="checkbox" name="public" defaultChecked />
            Public
          </label>
          <button className="btn-primary inline-flex min-h-11 items-center justify-center gap-2" type="submit">
            <Plus size={16} />
            Add Project
          </button>
        </div>
      </form>

      {projects.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <article className="moe-panel overflow-hidden rounded-2xl" key={project.id}>
              {project.imageUrl ? (
                <div className="h-44 border-b border-violet-300/10 bg-cover bg-center" style={{ backgroundImage: `url(${project.imageUrl})` }} />
              ) : (
                <div className="grid h-44 place-items-center border-b border-violet-300/10 bg-violet-500/10 text-violet-200">
                  <FolderKanban size={34} />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-lg font-black text-white">{project.title}</h2>
                    <p className="mt-2 text-xs font-bold text-slate-500">{formatDate(project.createdAt)}</p>
                  </div>
                  <Badge tone={project.public ? 'green' : 'slate'}>{project.public ? 'Public' : 'Private'}</Badge>
                </div>
                {project.description ? (
                  <p className="mt-4 line-clamp-3 text-sm font-semibold leading-6 text-slate-300">{project.description}</p>
                ) : null}
                {project.url ? (
                  <a className="mt-5 inline-flex items-center gap-2 text-sm font-black text-violet-200 hover:text-white" href={project.url} target="_blank" rel="noreferrer">
                    Open project
                    <ExternalLink size={15} />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No portfolio projects yet"
          description="Add projects that prove your learning outcomes, then share them from your public student profile."
        />
      )}
    </DashboardShell>
  );
}
