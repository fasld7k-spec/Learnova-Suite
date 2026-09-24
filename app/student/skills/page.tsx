import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { getSiteSettings } from '@/lib/site-settings';

export default async function Skills() {
  const user = await requireUser(['STUDENT']);
  const [rows, settings] = await Promise.all([
    prisma.skillProfile.findMany({ where: { userId: user.id }, orderBy: { skill: 'asc' } }),
    getSiteSettings()
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);

  return (
    <DashboardShell role="student" title="Skill Profile">
      <form className="card mb-6 grid gap-3 md:grid-cols-4" action="/api/student/skills" method="post">
        <CsrfInput />
        <input className="input" name="skill" placeholder={t('Skill')} />
        <select className="input" name="level" defaultValue="beginner">
          <option value="beginner">{t('Beginner')}</option>
          <option value="intermediate">{t('Intermediate')}</option>
          <option value="advanced">{t('Advanced')}</option>
        </select>
        <input className="input" name="source" placeholder={t('Source')} />
        <button className="btn-primary">{t('Save Skill')}</button>
      </form>
      <DataTable
        headers={['Skill', 'Level', 'Source'].map(t)}
        rows={rows.map((skill) => [skill.skill, t(skill.level), skill.source || '-'])}
      />
    </DashboardShell>
  );
}
