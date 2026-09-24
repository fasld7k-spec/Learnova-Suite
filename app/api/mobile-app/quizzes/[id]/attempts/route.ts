import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { awardAchievement } from "@/lib/achievements";
import { isLessonDripUnlocked } from "@/lib/drip-access";
import { enrolledCourseForLesson } from "@/lib/enrollment";
import { fromJsonArray } from "@/lib/json-fields";
import { studentForRequest } from "@/lib/mobile-app-adapter";
import { prisma } from "@/lib/prisma";

type QuizQuestion = {
  q?: string;
  answer?: string | string[];
};

function normalizeAnswer(value: unknown) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

function answerAt(answers: unknown, index: number) {
  if (Array.isArray(answers)) return answers[index];
  if (answers && typeof answers === "object") {
    const record = answers as Record<string, unknown>;
    return record[String(index)] ?? record[`q_${index}`];
  }
  return undefined;
}

function isCorrect(question: QuizQuestion, submitted: unknown) {
  const expected = Array.isArray(question.answer)
    ? question.answer.join(",")
    : question.answer;
  return normalizeAnswer(submitted) === normalizeAnswer(expected);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const student = await studentForRequest(request);
    if (!student) return fail("Unauthenticated", 401);

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return fail("Quiz not found", 404);

    const courseId = await enrolledCourseForLesson(student.id, quiz.lessonId);
    if (!courseId) return fail("Quiz not found", 404);
    if (
      !(await isLessonDripUnlocked({
        userId: student.id,
        courseId,
        lessonId: quiz.lessonId,
      }))
    ) {
      return fail("Quiz is not unlocked yet.", 403);
    }

    const questions = fromJsonArray<QuizQuestion>(quiz.questions);
    if (!questions.length) return fail("Quiz has no questions.", 422);

    const correct = questions.reduce(
      (total, question, index) =>
        total + (isCorrect(question, answerAt(body.answers, index)) ? 1 : 0),
      0,
    );
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= quiz.passingScore;
    const attempt = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId: student.id, score, passed },
    });

    if (passed) {
      await awardAchievement({
        userId: student.id,
        title: score >= 90 ? "Quiz Master" : "Quiz Passed",
        icon: score >= 90 ? "trophy" : "check",
        reason: `${score}% score on ${quiz.title}`,
      });
    }

    return ok({
      id: attempt.id,
      quizId: quiz.id,
      score,
      passed,
      correctCount: correct,
      totalQuestions: questions.length,
      passingScore: quiz.passingScore,
      createdAt: attempt.createdAt.toISOString(),
    });
  } catch (error: any) {
    return fail(error?.message || "Unable to submit quiz attempt", 500);
  }
}
