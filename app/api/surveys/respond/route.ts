import { NextRequest, NextResponse } from 'next/server';
import { fail, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { fromJsonArray, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/request-security';

type SurveyQuestion = { name?: string; label?: string; type?: 'text' | 'rating' | 'boolean' };

function acceptsJson(req: NextRequest) {
  return req.headers.get('accept')?.includes('application/json');
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public.survey', 10, 10 * 60_000);
  if (limited) return limited;

  const f = await req.formData();
  if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
  const surveyId = String(f.get('surveyId'));
  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return fail('Survey not found', 404);
  if (!survey.active) return fail('Survey is closed', 403);
  const questions = fromJsonArray<SurveyQuestion>(survey.questions);
  const answers: Record<string, string> = {};
  for (const [k, v] of f.entries()) {
    if (k !== 'surveyId' && k !== 'csrf_token' && k !== 'csrfToken') answers[k] = String(v).trim();
  }

  for (const [index, question] of questions.entries()) {
    const name = question.name || `q${index + 1}`;
    const answer = answers[name] || '';
    if (!answer) return fail(`${question.label || name} is required`, 422);
    if (question.type === 'rating' && !['1', '2', '3', '4', '5'].includes(answer)) return fail(`${question.label || name} must be a rating from 1 to 5`, 422);
    if (question.type === 'boolean' && !['yes', 'no'].includes(answer)) return fail(`${question.label || name} must be yes or no`, 422);
  }

  const session = await getSession();
  await prisma.surveyResponse.create({
    data: {
      surveyId,
      userId: session?.id,
      answers: toJson(answers),
    },
  });
  if (!acceptsJson(req)) {
    return NextResponse.redirect(new URL(`/surveys/${surveyId}?submitted=1`, req.url), 303);
  }
  return ok({ message: 'Thank you for your feedback' });
}
