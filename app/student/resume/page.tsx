import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function Resume() {
  const user = await requireUser(['STUDENT']);
  const resume = await prisma.resumeProfile.findUnique({ where: { userId: user.id } });
  const links = fromJsonObject<Record<string, string>>(resume?.links);

  return (
    <DashboardShell role="student" title="Resume Profile">
      <form className="card grid gap-3" action="/api/student/resume" method="post">
        <CsrfInput />
        <input className="input" name="headline" placeholder="Headline" defaultValue={resume?.headline || ''} />
        <textarea className="input min-h-28" name="summary" placeholder="Professional summary" defaultValue={resume?.summary || ''} />
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input" name="website" placeholder="Portfolio URL" defaultValue={links.website || ''} />
          <input className="input" name="linkedin" placeholder="LinkedIn URL" defaultValue={links.linkedin || ''} />
          <input className="input" name="github" placeholder="GitHub URL" defaultValue={links.github || ''} />
        </div>
        <button className="btn-primary w-fit">Save Resume</button>
      </form>
    </DashboardShell>
  );
}
