import { BadgeCheck, Map as MapIcon, Route, Sparkles } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fromJsonArray } from '@/lib/json-fields';
import { Badge } from '@/components/dashboard/Badge';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { CsrfInput } from '@/components/CsrfInput';

function skillCount(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return raw.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).length;
  }
}

function skillText(raw: string) {
  const parsed = fromJsonArray<string>(raw);
  return parsed.length ? parsed.join('\n') : raw;
}

export default async function CareerTracks() {
  await requireUser(['ADMIN']);
  const [tracks, enrollments] = await Promise.all([
    prisma.careerTrack.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.careerTrackEnrollment.findMany()
  ]);

  const active = tracks.filter((track) => track.active).length;
  const totalSkills = tracks.reduce((sum, track) => sum + skillCount(track.skillIds), 0);
  const enrollmentCounts = new Map<string, number>();
  enrollments.forEach((enrollment) => {
    enrollmentCounts.set(enrollment.careerTrackId, (enrollmentCounts.get(enrollment.careerTrackId) ?? 0) + 1);
  });

  return (
    <DashboardShell role="admin" title="Career Tracks">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tracks" value={tracks.length} icon={<Route size={18} />} />
        <StatCard label="Active" value={active} icon={<BadgeCheck size={18} />} />
        <StatCard label="Mapped skills" value={totalSkills} icon={<Sparkles size={18} />} />
        <StatCard label="Enrollments" value={enrollments.length} icon={<MapIcon size={18} />} />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <form className="border border-[#2F3336] bg-black p-5" action="/api/admin/career-tracks" method="post">
          <CsrfInput />
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-[#71767B]">Career navigation</p>
            <h2 className="mt-1 text-2xl font-black text-white">Create a guided learning path</h2>
            <p className="mt-2 text-sm leading-6 text-[#71767B]">
              Tracks connect skills, course discovery and learner goals so buyers see a product beyond a simple course directory.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" name="title" placeholder="Career title" required />
            <input className="input" name="slug" placeholder="career-slug" required />
          </div>
          <textarea className="input mt-3 min-h-24" name="description" placeholder="Description" required />
          <textarea className="input mt-3 min-h-24" name="skillIds" placeholder="Skill IDs or names, one per line" />
          <label className="mt-4 flex w-fit items-center gap-2 border border-[#2F3336] px-4 py-3 text-sm font-bold text-[#E7E9EA]">
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button className="btn-primary mt-4 w-fit">Save Track</button>
        </form>

        <aside className="border border-[#2F3336] bg-black p-5">
          <p className="text-xs font-bold uppercase text-[#71767B]">Catalog strategy</p>
          <h3 className="mt-1 text-xl font-black text-white">Path readiness</h3>
          <div className="mt-4 space-y-3 text-sm text-[#E7E9EA]">
            <div className="flex items-center justify-between gap-3">
              <span>Active tracks</span>
              <Badge tone={active ? 'green' : 'yellow'}>{active}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Skill mapping</span>
              <Badge tone={totalSkills ? 'green' : 'yellow'}>{totalSkills ? 'Ready' : 'Missing'}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Learner demand</span>
              <Badge tone={enrollments.length ? 'green' : 'slate'}>{enrollments.length}</Badge>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6">
        <DataTable
          headers={['Track', 'Slug', 'Skills', 'Enrollments', 'Status', 'Manage']}
          rows={tracks.map((track) => [
            <div key="track">
              <p className="font-bold text-white">{track.title}</p>
              <p className="mt-1 line-clamp-1 text-xs text-[#71767B]">{track.description}</p>
            </div>,
            <code key="slug" className="text-xs text-[#1D9BF0]">{track.slug}</code>,
            skillCount(track.skillIds),
            enrollmentCounts.get(track.id) ?? 0,
            <Badge key="active" tone={track.active ? 'green' : 'red'}>{track.active ? 'Active' : 'Disabled'}</Badge>,
            <div key="manage" className="grid min-w-96 gap-2">
              <form className="grid gap-2" action="/api/admin/career-tracks" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="update" />
                <input type="hidden" name="id" value={track.id} />
                <input className="input" name="title" defaultValue={track.title} />
                <input className="input" name="slug" defaultValue={track.slug} />
                <textarea className="input min-h-24" name="description" defaultValue={track.description} />
                <textarea className="input min-h-24" name="skillIds" defaultValue={skillText(track.skillIds)} />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <input type="checkbox" name="active" defaultChecked={track.active} /> Active
                </label>
                <button className="btn-secondary w-fit">Update</button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action="/api/admin/career-tracks" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="toggle" />
                  <input type="hidden" name="id" value={track.id} />
                  <button className="btn-secondary">{track.active ? 'Disable' : 'Enable'}</button>
                </form>
                <form action="/api/admin/career-tracks" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="delete" />
                  <input type="hidden" name="id" value={track.id} />
                  <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
                </form>
              </div>
            </div>
          ])}
        />
      </section>
    </DashboardShell>
  );
}
