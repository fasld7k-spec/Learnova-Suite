import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { localizedDashboardLabel } from '@/lib/localized-copy';
import { prisma } from '@/lib/prisma';
import { getSiteSettings } from '@/lib/site-settings';

export default async function InstructorQuestions() {
  const user = await requireUser(['INSTRUCTOR']);
  const [questions, settings] = await Promise.all([
    prisma.question.findMany({
      where: { course: { instructorId: user.id } },
      include: { course: true, user: true },
      orderBy: { createdAt: 'desc' }
    }),
    getSiteSettings()
  ]);
  const t = (label: string) => localizedDashboardLabel(label, settings.defaultLanguage);
  const reports = questions.length
    ? await prisma.abuseReport.groupBy({
        by: ['targetId'],
        where: { targetType: 'QUESTION', targetId: { in: questions.map((question) => question.id) } },
        _count: { _all: true },
      })
    : [];
  const reportsByQuestion = new Map(reports.map((report) => [report.targetId, report._count._all]));
  const answered = questions.filter((question) => question.answer).length;

  return (
    <DashboardShell role="instructor" title="Student Questions">
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">{t('Open questions')}</p>
          <p className="mt-2 text-3xl font-black">{questions.length - answered}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{t('Answered')}</p>
          <p className="mt-2 text-3xl font-black">{answered}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">{t('Reports')}</p>
          <p className="mt-2 text-3xl font-black">{reports.reduce((sum, report) => sum + report._count._all, 0)}</p>
        </div>
      </div>
      <div className="grid gap-4">
        {questions.map((question) => (
          <div className="card" key={question.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>{question.course.title} - {question.user.name}</span>
              <span className="rounded-full border border-[#2F3336] px-3 py-1 text-xs font-bold text-[#E7E9EA]">
                {question.answer ? t('Answered') : t('Needs reply')}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold">{question.title}</h2>
            <p className="mt-2">{question.body}</p>
            {Boolean(reportsByQuestion.get(question.id)) && (
              <p className="mt-3 rounded-lg border border-[#FFD400] p-3 text-sm font-bold text-[#FFD400]">
                {reportsByQuestion.get(question.id)} {t('moderation report(s)')}
              </p>
            )}
            {question.answer ? (
              <p className="mt-4 border-l-2 border-[#00BA7C] bg-[#16181C] p-3 text-[#00BA7C]">{question.answer}</p>
            ) : (
              <form className="mt-4" action={`/api/instructor/questions/${question.id}/answer`} method="post">
                <CsrfInput />
                <textarea className="input" name="answer" placeholder={t('Write answer')} />
                <button className="btn-primary mt-2">{t('Answer')}</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
