import { notFound } from 'next/navigation';
import { CsrfInput } from '@/components/CsrfInput';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Footer } from '@/components/Footer';
import { QuizAttemptShell } from '@/components/learn/QuizAttemptShell';
import { Nav } from '@/components/Nav';
import { isLessonDripUnlocked } from '@/lib/drip-access';
import { enrolledCourseForLesson } from '@/lib/enrollment';
import { fromJsonArray } from '@/lib/json-fields';
import { requireUser } from '@/lib/auth';
import { getCsrfToken } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

type QuizQuestion = {
  q?: string;
  prompt?: string;
  type?: 'mcq' | 'choice' | 'true_false' | 'text' | 'ordering';
  options?: string[];
  answer?: string | string[];
};

export default async function QuizPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requireUser(['STUDENT', 'ADMIN']);
  const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
  if (!quiz) notFound();
  if (user.role === 'STUDENT') {
    const courseId = await enrolledCourseForLesson(user.id, quiz.lessonId);
    if (!courseId || !(await isLessonDripUnlocked({ userId: user.id, courseId, lessonId: quiz.lessonId }))) notFound();
  }

  const questions = fromJsonArray<QuizQuestion>(quiz.questions);
  const attempts = user.role === 'STUDENT'
    ? await prisma.quizAttempt.findMany({ where: { quizId: quiz.id, userId: user.id }, orderBy: { createdAt: 'desc' }, take: 5 })
    : [];
  const csrfToken = await getCsrfToken();

  const quizContent = (
    <>
      <div hidden><CsrfInput /></div>
      <QuizAttemptShell quiz={quiz} questions={questions} attempts={attempts} csrfToken={csrfToken} />
    </>
  );

  if (user.role === 'STUDENT') {
    return (
      <DashboardShell role="student" title={quiz.title}>
        {quizContent}
      </DashboardShell>
    );
  }

  return (
    <>
      <Nav />
      <main className="moe-page py-8">
        <div className="page-shell">
          {quizContent}
        </div>
      </main>
      <Footer />
    </>
  );
}
