'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileQuestion, ListChecks, Target } from 'lucide-react';

export type QuizShellQuestion = {
  q?: string;
  prompt?: string;
  type?: 'mcq' | 'choice' | 'true_false' | 'text' | 'ordering';
  options?: string[];
};

type QuizAttempt = {
  id: string;
  score: number;
  passed: boolean;
};

type Props = {
  quiz: {
    id: string;
    title: string;
    passingScore: number;
  };
  questions: QuizShellQuestion[];
  attempts: QuizAttempt[];
  csrfToken: string;
};

function questionLabel(question: QuizShellQuestion) {
  return question.q || question.prompt || 'Question';
}

function questionType(question: QuizShellQuestion) {
  return question.type === 'choice' ? 'mcq' : question.type || (question.options?.length ? 'mcq' : 'text');
}

export function QuizAttemptShell({ quiz, questions, attempts, csrfToken }: Props) {
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [current, setCurrent] = useState(0);
  const answeredCount = useMemo(() => Object.values(answered).filter(Boolean).length, [answered]);
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const markAnswered = (index: number, value: string) => {
    setCurrent(index);
    setAnswered((prev) => ({ ...prev, [index]: Boolean(value.trim()) }));
  };

  return (
    <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]" action="/api/student/quizzes/attempt" method="post">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="quizId" value={quiz.id} />
      <section className="moe-panel rounded-xl p-6 lg:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <a className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white" href="/student/quizzes">
              <ArrowLeft size={16} />
              Back to quizzes
            </a>
            <h1 className="mt-5 text-2xl font-black text-white">{quiz.title}</h1>
          </div>
          <div className="hidden grid-cols-2 gap-3 sm:grid">
            <div className="rounded-xl border border-violet-300/15 bg-white/[0.03] px-4 py-3 text-right">
              <p className="text-xs font-bold text-slate-400">Questions</p>
              <p className="mt-1 text-xl font-black text-white">{questions.length}</p>
            </div>
            <div className="rounded-xl border border-violet-300/15 bg-white/[0.03] px-4 py-3 text-right">
              <p className="text-xs font-bold text-slate-400">Passing Score</p>
              <p className="mt-1 text-xl font-black text-white">{quiz.passingScore}%</p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-400">
            <span>{answeredCount}/{questions.length} answered</span>
            <span>{progress}% ready</span>
          </div>
          <div className="moe-progress"><span style={{ width: `${progress}%` }} /></div>
        </div>

        {attempts.length > 0 && (
          <div className="mt-6 rounded-xl border border-violet-300/15 bg-white/[0.03] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <ListChecks size={17} className="text-violet-300" />
              Recent attempts
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {attempts.map((attempt) => (
                <span key={attempt.id} className="rounded-lg border border-violet-300/15 px-3 py-1 text-xs font-bold text-slate-200">
                  {attempt.score}% / {attempt.passed ? 'Passed' : 'Failed'}
                </span>
              ))}
            </div>
          </div>
        )}

        {questions.length ? questions.map((question, index) => {
          const type = questionType(question);
          const options = type === 'true_false' ? ['True', 'False'] : question.options || [];
          return (
            <section
              id={`question-${index + 1}`}
              key={`${questionLabel(question)}-${index}`}
              onFocusCapture={() => setCurrent(index)}
              className={index === 0 ? 'scroll-mt-24' : 'mt-8 scroll-mt-24 border-t border-violet-300/15 pt-8'}
            >
              <p className="text-sm font-bold text-slate-300">Question {index + 1}</p>
              <h2 className="mt-4 max-w-2xl text-xl font-black leading-snug text-white">{questionLabel(question)}</h2>
              <div className="mt-6 grid gap-3">
                {(type === 'mcq' || type === 'true_false') && options.map((option, optionIndex) => (
                  <label key={option} className="group flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border border-violet-300/15 bg-white/[0.03] px-4 text-sm font-bold text-slate-200 transition hover:border-violet-300/45 hover:bg-violet-500/10">
                    <input className="peer sr-only" type="radio" name={`q_${index}`} value={option} onChange={(event) => markAnswered(index, event.currentTarget.value)} />
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-violet-300/20 text-xs font-black text-slate-400 peer-checked:border-violet-400 peer-checked:bg-violet-600 peer-checked:text-white">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="flex-1">{option}</span>
                    <CheckCircle2 className="hidden text-violet-300 peer-checked:block" size={18} />
                  </label>
                ))}

                {type === 'text' && (
                  <input className="moe-control h-12 w-full px-4 text-sm font-semibold" name={`q_${index}`} placeholder="Type your answer" onChange={(event) => markAnswered(index, event.currentTarget.value)} />
                )}

                {type === 'ordering' && (
                  <>
                    <p className="text-sm text-slate-400">Write the correct order separated by commas.</p>
                    <input className="moe-control h-12 w-full px-4 text-sm font-semibold" name={`q_${index}`} placeholder="First, Second, Third" onChange={(event) => markAnswered(index, event.currentTarget.value)} />
                  </>
                )}
              </div>
            </section>
          );
        }) : (
          <div className="mt-8 rounded-xl border border-dashed border-violet-300/20 p-8 text-center">
            <p className="text-lg font-black text-white">This quiz is not ready yet</p>
            <p className="mt-2 text-sm text-slate-400">Questions have not been added by the instructor.</p>
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a className="moe-control inline-flex h-12 items-center justify-center text-sm font-black text-white" href="/student/quizzes">Back to quizzes</a>
          <button className="moe-primary inline-flex h-12 items-center justify-center rounded-lg text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50" disabled={!questions.length}>Submit Quiz</button>
        </div>
      </section>

      <aside className="moe-panel rounded-xl p-5 lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-lg font-black text-white">Question Navigator</h2>
        <div className="mt-4 grid gap-3 rounded-xl border border-violet-300/15 bg-white/[0.03] p-4 text-sm font-bold text-slate-300">
          <span className="inline-flex items-center gap-2"><FileQuestion size={16} className="text-violet-300" /> {questions.length} Questions</span>
          <span className="inline-flex items-center gap-2"><Target size={16} className="text-violet-300" /> Pass {quiz.passingScore}%</span>
        </div>
        <div className="mt-5 grid grid-cols-5 gap-3 lg:grid-cols-3">
          {questions.map((_, index) => (
            <a key={index} href={`#question-${index + 1}`} onClick={() => setCurrent(index)} className={`grid h-11 w-11 place-items-center rounded-full text-sm font-black transition hover:-translate-y-0.5 ${
              answered[index] ? 'bg-emerald-500 text-white' : index === current ? 'bg-violet-600 text-white shadow-[0_0_26px_rgba(124,60,255,0.35)]' : 'bg-white/8 text-slate-300 hover:bg-violet-500/20'
            }`}>
              {index + 1}
            </a>
          ))}
          {!questions.length ? <p className="col-span-full text-sm font-semibold text-slate-400">No questions available.</p> : null}
        </div>
        <div className="mt-8 grid gap-3 border-t border-violet-300/15 pt-5 text-sm font-bold text-slate-300">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Answered</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Current</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Unanswered</span>
        </div>
        <button className="moe-primary mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50" disabled={!questions.length}>Submit Quiz</button>
      </aside>
    </form>
  );
}
