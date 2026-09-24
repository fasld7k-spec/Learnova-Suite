import Link from 'next/link';
import { CheckCircle2, FileQuestion, PlayCircle, RotateCcw, Target, XCircle } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { requireUser } from '@/lib/auth';
import { isLessonDripUnlocked } from '@/lib/drip-access';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function StudentQuizzes() {
  const user = await requireUser(['STUDENT']);
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          modules: { include: { lessons: true } },
        },
      },
    },
  });
  const lessonToCourse = new Map<string, { id: string; title: string; slug: string }>();
  const lessonIds = enrollments.flatMap((enrollment) => enrollment.course.modules.flatMap((module) => module.lessons.map((lesson) => {
    lessonToCourse.set(lesson.id, { id: enrollment.courseId, title: enrollment.course.title, slug: enrollment.course.slug });
    return lesson.id;
  })));
  const unlockedLessonIds = new Set((await Promise.all(lessonIds.map(async (lessonId) => {
    const course = lessonToCourse.get(lessonId);
    if (!course) return null;
    return await isLessonDripUnlocked({ userId: user.id, courseId: course.id, lessonId }) ? lessonId : null;
  }))).filter((lessonId): lessonId is string => Boolean(lessonId)));
  const availableQuizzes = unlockedLessonIds.size
    ? await prisma.quiz.findMany({
        where: { lessonId: { in: [...unlockedLessonIds] } },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: user.id },
    include: { quiz: true },
    orderBy: { createdAt: 'desc' },
  });
  const passed = attempts.filter((attempt) => attempt.passed).length;
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : 0;
  const latestAttemptByQuiz = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!latestAttemptByQuiz.has(attempt.quizId)) latestAttemptByQuiz.set(attempt.quizId, attempt);
  }

  return (
    <DashboardShell role="student" title="Quizzes">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Quiz Attempts" value={attempts.length} icon={<FileQuestion size={18} />} />
        <StatCard label="Passed" value={passed} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Average Score" value={`${average}%`} icon={<FileQuestion size={18} />} />
      </div>

      <section className="mt-6 rounded-xl border border-violet-300/15 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase text-violet-300">Practice center</p>
            <h2 className="mt-1 text-2xl font-black text-white">Available quizzes</h2>
          </div>
          <Link href="/student/my-courses" className="rounded-lg bg-white/[0.06] px-4 py-2 text-sm font-black text-white hover:bg-violet-500/20">
            My courses
          </Link>
        </div>

        {availableQuizzes.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {availableQuizzes.map((quiz) => {
              const latest = latestAttemptByQuiz.get(quiz.id);
              const course = lessonToCourse.get(quiz.lessonId);
              const questionCount = fromJsonArray<unknown>(quiz.questions).length;
              const playable = questionCount > 0;
              return (
                <article key={quiz.id} className="rounded-xl border border-violet-300/15 bg-[#070d1b] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold uppercase text-slate-400">{course?.title || 'Enrolled course'}</p>
                      <h3 className="mt-2 line-clamp-2 text-lg font-black text-white">{quiz.title}</h3>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${!playable ? 'bg-slate-500/15 text-slate-300' : latest?.passed ? 'bg-emerald-500/15 text-emerald-300' : latest ? 'bg-amber-500/15 text-amber-300' : 'bg-violet-500/15 text-violet-300'}`}>
                      {!playable ? 'Draft' : latest?.passed ? 'Passed' : latest ? 'Retry' : 'New'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-300 sm:grid-cols-3">
                    <span className="inline-flex items-center gap-2"><FileQuestion size={16} /> {questionCount} Questions</span>
                    <span className="inline-flex items-center gap-2"><Target size={16} /> Pass {quiz.passingScore}%</span>
                    <span className="inline-flex items-center gap-2">{latest ? <CheckCircle2 size={16} /> : <PlayCircle size={16} />} {latest ? `${latest.score}% latest` : 'Not started'}</span>
                  </div>
                  {playable ? (
                    <Link href={`/learn/quiz/${quiz.id}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-black text-white hover:bg-violet-500">
                      {latest ? <RotateCcw size={16} /> : <PlayCircle size={16} />}
                      {latest ? 'Retake quiz' : 'Start quiz'}
                    </Link>
                  ) : (
                    <span className="mt-4 inline-flex h-10 items-center rounded-lg border border-slate-700 px-4 text-sm font-black text-slate-400">
                      Awaiting questions
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-violet-300/20 p-8 text-center">
            <p className="text-lg font-black text-white">No available quizzes yet</p>
            <p className="mt-2 text-sm text-slate-400">Enroll in a course with quizzes and they will appear here.</p>
            <Link href="/courses" className="mt-5 inline-flex h-11 items-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white">
              Browse courses
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6">
        {attempts.length ? (
          <DataTable
            headers={['Quiz', 'Score', 'Result', 'Date']}
            rows={attempts.map((attempt) => [
              attempt.quiz.title,
              `${attempt.score}%`,
              <span key="result" className={`inline-flex items-center gap-2 text-sm font-black ${attempt.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                {attempt.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {attempt.passed ? 'Passed' : 'Needs review'}
              </span>,
              attempt.createdAt.toLocaleDateString(),
            ])}
          />
        ) : (
          <div className="moe-panel rounded-xl p-8 text-center">
            <p className="text-lg font-black text-white">No quiz attempts yet</p>
            <p className="mt-2 text-sm text-slate-400">Quizzes you take during lessons will appear here.</p>
            <Link href="/student/my-courses" className="mt-5 inline-flex h-11 items-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white">
              Continue learning
            </Link>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
