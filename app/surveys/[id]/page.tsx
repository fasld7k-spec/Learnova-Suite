import { notFound } from 'next/navigation';
import { CsrfInput } from '@/components/CsrfInput';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

type SurveyQuestion = { name?: string; label?: string; type?: 'text' | 'rating' | 'boolean' };

function SurveyQuestionField({ question, index }: { question: SurveyQuestion; index: number }) {
  const name = question.name || `q${index + 1}`;
  const type = question.type || 'text';

  return (
    <label className="mt-5 block">
      <span className="font-bold text-white">{question.label || `Question ${index + 1}`}</span>
      {type === 'rating' ? (
        <select className="moe-control mt-2 w-full" name={name} required defaultValue="">
          <option value="" disabled>Select a rating</option>
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Okay</option>
          <option value="2">2 - Needs work</option>
          <option value="1">1 - Poor</option>
        </select>
      ) : type === 'boolean' ? (
        <select className="moe-control mt-2 w-full" name={name} required defaultValue="">
          <option value="" disabled>Select an answer</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      ) : (
        <textarea className="moe-control mt-2 min-h-28 w-full" name={name} required />
      )}
    </label>
  );
}

export default async function SurveyPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<{ submitted?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const survey = await prisma.survey.findUnique({ where: { id: params.id } });
  if (!survey || !survey.active) notFound();
  const questions = fromJsonArray<SurveyQuestion>(survey.questions);

  return (
    <>
      <Nav />
      <main className="moe-page py-12">
        <form className="moe-panel mx-auto max-w-2xl p-8" action="/api/surveys/respond" method="post">
          <CsrfInput />
          <input type="hidden" name="surveyId" value={survey.id} />
          <h1 className="text-3xl font-black text-white">{survey.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Share structured feedback to help improve courses, support, and platform quality.</p>
          {searchParams?.submitted && (
            <div className="mt-5 border border-[#00BA7C]/50 bg-[#00BA7C]/10 p-4 text-sm font-bold text-[#D7FBE8]">
              Thank you. Your response has been saved.
            </div>
          )}
          {questions.map((question, index) => <SurveyQuestionField key={question.name || index} question={question} index={index} />)}
          <button className="moe-primary mt-6">Submit Survey</button>
        </form>
      </main>
      <Footer />
    </>
  );
}
