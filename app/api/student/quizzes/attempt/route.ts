import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { awardAchievement } from '@/lib/achievements';
import { verifyCsrf } from '@/lib/csrf';
import { isLessonDripUnlocked } from '@/lib/drip-access';
import { enrolledCourseForLesson } from '@/lib/enrollment';
import { fromJsonArray } from '@/lib/json-fields';

type QuizQuestion = {
  q: string;
  type?: 'mcq' | 'true_false' | 'text' | 'ordering';
  options?: string[];
  answer?: string | string[];
};

function normalizeAnswer(value: unknown) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .join('|');
}

function isCorrect(question: QuizQuestion, submitted: FormDataEntryValue | null) {
  const expected = Array.isArray(question.answer) ? question.answer.join(',') : question.answer;
  return normalizeAnswer(submitted) === normalizeAnswer(expected);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const quiz = await prisma.quiz.findUnique({ where: { id: String(f.get('quizId')) } });
    if (!quiz) return fail('Quiz not found', 404);

    const courseId = await enrolledCourseForLesson(user.id, quiz.lessonId);
    if (!courseId) return fail('Quiz not found', 404);
    if (!(await isLessonDripUnlocked({ userId: user.id, courseId, lessonId: quiz.lessonId }))) return fail('Quiz is not unlocked yet.', 403);

    const questions = fromJsonArray<QuizQuestion>(quiz.questions);
    const correct = questions.reduce((total, question, index) => total + (isCorrect(question, f.get(`q_${index}`)) ? 1 : 0), 0);
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= quiz.passingScore;

    await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId: user.id, score, passed } });

    if (passed) {
      await awardAchievement({
        userId: user.id,
        title: score >= 90 ? 'Quiz Master' : 'Quiz Passed',
        icon: score >= 90 ? 'trophy' : 'check',
        reason: `${score}% score on ${quiz.title}`,
      });
    }

    return NextResponse.redirect(new URL(`/quiz-result?score=${score}&passed=${passed}&quizId=${quiz.id}`, req.url), 303);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
