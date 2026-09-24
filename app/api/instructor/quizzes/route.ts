import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedInstructor } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail } from '@/lib/api';
import { toJson } from '@/lib/json-fields';
import { verifyCsrf } from '@/lib/csrf';

function parseQuestions(form: FormData) {
  const prompts = form.getAll('questionPrompt').map((value) => String(value || '').trim());
  const answers = form.getAll('answer').map((value) => String(value || '').trim());
  const optionGroups = ['optionA', 'optionB', 'optionC', 'optionD'].map((key) =>
    form.getAll(key).map((value) => String(value || '').trim()),
  );
  return prompts
    .map((prompt, index) => {
      const options = optionGroups.map((group) => group[index] || '').filter(Boolean);
      return {
        q: prompt,
        type: 'mcq',
        options,
        answer: answers[index] || '',
      };
    })
    .filter((question) => question.q || question.options.length || question.answer);
}

function assertValidQuestions(questions: ReturnType<typeof parseQuestions>) {
  if (!questions.length || questions.some((question) => !question.q || question.options.length < 2 || !question.answer)) {
    throw new Error('Each saved question needs text, at least two options, and a correct answer.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireApprovedInstructor();
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('action') || 'create');

    if (action === 'delete') {
      const lessons = await prisma.lesson.findMany({
        where: { module: { course: { instructorId: user.id } } },
        select: { id: true }
      });
      const quiz = await prisma.quiz.findFirst({ where: { id: String(form.get('quizId') || ''), lessonId: { in: lessons.map((lesson) => lesson.id) } } });
      if (!quiz) return fail('Quiz not found', 404);
      await prisma.quizAttempt.deleteMany({ where: { quizId: quiz.id } });
      await prisma.quiz.delete({ where: { id: quiz.id } });
      return NextResponse.redirect(new URL('/instructor/quizzes', req.url), 303);
    }

    if (action === 'update') {
      const lessons = await prisma.lesson.findMany({
        where: { module: { course: { instructorId: user.id } } },
        select: { id: true }
      });
      const quiz = await prisma.quiz.findFirst({ where: { id: String(form.get('quizId') || ''), lessonId: { in: lessons.map((lesson) => lesson.id) } } });
      if (!quiz) return fail('Quiz not found', 404);
      const questions = parseQuestions(form);
      assertValidQuestions(questions);
      await prisma.quiz.update({
        where: { id: quiz.id },
        data: {
          title: String(form.get('title') || quiz.title).trim(),
          questions: toJson(questions),
          passingScore: Math.min(100, Math.max(1, Number(form.get('passingScore') || quiz.passingScore))),
        },
      });
      return NextResponse.redirect(new URL('/instructor/quizzes', req.url), 303);
    }

    const lesson = await prisma.lesson.findFirst({
      where: { id: String(form.get('lessonId')), module: { course: { instructorId: user.id } } },
    });
    if (!lesson) return fail('Lesson not found', 404);

    const questions = parseQuestions(form);
    assertValidQuestions(questions);

    await prisma.quiz.create({
      data: {
        lessonId: lesson.id,
        title: String(form.get('title')),
        questions: toJson(questions),
        passingScore: Number(form.get('passingScore') || 70),
      },
    });
    return NextResponse.redirect(new URL('/instructor/quizzes', req.url), 303);
  } catch (e: any) {
    const message = e?.message || 'Unable to save quiz';
    return fail(message, message.includes('Each saved question') ? 422 : 500);
  }
}
