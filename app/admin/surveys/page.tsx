import { Badge } from '@/components/dashboard/Badge';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { fromJsonArray, fromJsonObject } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { CsrfInput } from '@/components/CsrfInput';

type SurveyQuestion = { name?: string; label?: string; type?: string };
type SurveyAnswer = Record<string, unknown>;

function firstQuestion(raw: string): SurveyQuestion {
  return fromJsonArray<SurveyQuestion>(raw)[0] || {};
}

export default async function Surveys() {
  await requireUser(['ADMIN']);
  const [rows, responses] = await Promise.all([
    prisma.survey.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.surveyResponse.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const responseStats = responses.reduce<Record<string, { count: number; latest?: { answers: SurveyAnswer; createdAt: Date } }>>((acc, response) => {
    const current = acc[response.surveyId] || { count: 0 };
    current.count += 1;
    if (!current.latest || response.createdAt > current.latest.createdAt) {
      current.latest = { answers: fromJsonObject<SurveyAnswer>(response.answers), createdAt: response.createdAt };
    }
    acc[response.surveyId] = current;
    return acc;
  }, {});

  return (
    <DashboardShell role="admin" title="Surveys">
      <form className="card mb-6 grid gap-3" action="/api/admin/surveys" method="post">
          <CsrfInput />
        <input className="input" name="title" placeholder="Survey title" required />
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input md:col-span-2" name="questionLabel" placeholder="Question label" required />
          <select className="input" name="questionType" defaultValue="text">
            <option value="text">Text answer</option>
            <option value="rating">Rating 1-5</option>
            <option value="boolean">Yes / No</option>
          </select>
        </div>
        <label className="flex gap-2">
          <input type="checkbox" name="active" defaultChecked /> Active
        </label>
        <button className="btn-primary w-fit">Create Survey</button>
      </form>
      <DataTable
        headers={['Title', 'Question', 'Type', 'Responses', 'Active', 'Date', 'Manage']}
        rows={rows.map((survey) => {
          const question = firstQuestion(survey.questions);
          const stats = responseStats[survey.id] || { count: 0 };
          const latestAnswer = stats.latest?.answers?.[question.name || 'q1'];
          return [
          survey.title,
          question.label || '-',
          question.type || 'text',
          <div key="responses" className="min-w-52">
            <p className="font-black text-white">{stats.count}</p>
            <p className="mt-1 line-clamp-2 text-xs text-[#71767B]">
              {latestAnswer ? `Latest: ${String(latestAnswer)}` : 'No responses yet'}
            </p>
            <a className="mt-2 inline-block text-xs font-black text-[#1D9BF0]" href={`/surveys/${survey.id}`} target="_blank">
              Open public form
            </a>
          </div>,
          <Badge key="a" tone={survey.active ? 'green' : 'red'}>
            {survey.active ? 'Active' : 'Disabled'}
          </Badge>,
          survey.createdAt.toLocaleDateString(),
          <div key="manage" className="grid min-w-80 gap-2">
            <form className="grid gap-2" action="/api/admin/surveys" method="post">
          <CsrfInput />
              <input type="hidden" name="_action" value="update" />
              <input type="hidden" name="id" value={survey.id} />
              <input className="input" name="title" defaultValue={survey.title} />
              <input className="input" name="questionLabel" defaultValue={question.label || ''} />
              <select className="input" name="questionType" defaultValue={question.type || 'text'}>
                <option value="text">Text answer</option>
                <option value="rating">Rating 1-5</option>
                <option value="boolean">Yes / No</option>
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input type="checkbox" name="active" defaultChecked={survey.active} /> Active
              </label>
              <button className="btn-secondary w-fit">Update</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action="/api/admin/surveys" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="toggle" />
                <input type="hidden" name="id" value={survey.id} />
                <button className="btn-secondary">{survey.active ? 'Disable' : 'Enable'}</button>
              </form>
              {stats.count > 0 && (
                <form action="/api/admin/surveys" method="post">
          <CsrfInput />
                  <input type="hidden" name="_action" value="clear_responses" />
                  <input type="hidden" name="id" value={survey.id} />
                  <button className="btn-secondary">Clear responses</button>
                </form>
              )}
              <form action="/api/admin/surveys" method="post">
          <CsrfInput />
                <input type="hidden" name="_action" value="delete" />
                <input type="hidden" name="id" value={survey.id} />
                <button className="btn-secondary border-red-400/40 text-red-200">Delete</button>
              </form>
            </div>
          </div>,
        ];})}
      />
    </DashboardShell>
  );
}
