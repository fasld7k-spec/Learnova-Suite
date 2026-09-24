import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { CsrfInput } from '@/components/CsrfInput';
import { requireUser } from '@/lib/auth';
import { fromJsonArray } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export default async function InstructorQuizzes() {
  const user = await requireUser(['INSTRUCTOR']);
  const lessons = await prisma.lesson.findMany({
    where: { module: { course: { instructorId: user.id } } },
    include: { module: { include: { course: true } } },
    orderBy: { title: 'asc' },
  });
  const quizzes = await prisma.quiz.findMany({ where: { lessonId: { in: lessons.map((lesson) => lesson.id) } }, orderBy: { createdAt: 'desc' } });
  const lessonTitles = new Map(lessons.map((lesson) => [lesson.id, `${lesson.module.course.title} / ${lesson.title}`]));
  const questionSlots = [0, 1, 2, 3, 4];

  return (
    <DashboardShell role="instructor" title="Quiz Builder">
      <form className="card mb-6 grid gap-3" action="/api/instructor/quizzes" method="post">
        <CsrfInput />
        <select className="input" name="lessonId" required>
          <option value="">Select lesson</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.module.course.title} / {lesson.title}
            </option>
          ))}
        </select>
        <input className="input" name="title" placeholder="Quiz title" required />
        {questionSlots.map((slot) => (
          <div key={slot} className="grid gap-3 border border-[#2F3336] bg-[#16181C] p-4">
            <p className="text-sm font-black text-white">Question {slot + 1}{slot === 0 ? ' (required)' : ' (optional)'}</p>
            <input className="input" name="questionPrompt" placeholder="Question text" required={slot === 0} />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="input" name="optionA" placeholder="Option A" required={slot === 0} />
              <input className="input" name="optionB" placeholder="Option B" required={slot === 0} />
              <input className="input" name="optionC" placeholder="Option C" />
              <input className="input" name="optionD" placeholder="Option D" />
            </div>
            <input className="input" name="answer" placeholder="Correct answer text" required={slot === 0} />
          </div>
        ))}
        <input className="input" name="passingScore" type="number" min={1} max={100} defaultValue={70} />
        <button className="btn-primary w-fit">Create Quiz</button>
      </form>

      <DataTable
        headers={['Title', 'Lesson', 'Questions', 'Passing', 'Created', 'Manage']}
        rows={quizzes.map((quiz) => {
          const questions = fromJsonArray<{ q?: string; options?: string[]; answer?: string }>(quiz.questions);
          return [
            quiz.title,
            lessonTitles.get(quiz.lessonId) || 'Archived lesson',
            questions.length,
            `${quiz.passingScore}%`,
            quiz.createdAt.toLocaleDateString(),
            <div key="manage" className="grid min-w-[520px] gap-2">
            <form className="grid gap-2" action="/api/instructor/quizzes" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="update" />
              <input type="hidden" name="quizId" value={quiz.id} />
              <input className="input" name="title" defaultValue={quiz.title} aria-label="Quiz title" />
              <div className="grid gap-3">
                {questionSlots.map((slot) => {
                  const question = questions[slot];
                  const options = question?.options || [];
                  return (
                    <details key={slot} className="rounded-lg border border-[#2F3336] bg-[#050505] p-3" open={slot === 0 || Boolean(question)}>
                      <summary className="cursor-pointer text-xs font-black text-[#1D9BF0]">Question {slot + 1}{slot === 0 ? ' (required)' : ' (optional)'}</summary>
                      <div className="mt-3 grid gap-2">
                        <input className="input" name="questionPrompt" defaultValue={question?.q || ''} placeholder="Question text" required={slot === 0} />
                        <div className="grid gap-2 md:grid-cols-2">
                          <input className="input" name="optionA" defaultValue={options[0] || ''} placeholder="Option A" required={slot === 0} />
                          <input className="input" name="optionB" defaultValue={options[1] || ''} placeholder="Option B" required={slot === 0} />
                          <input className="input" name="optionC" defaultValue={options[2] || ''} placeholder="Option C" />
                          <input className="input" name="optionD" defaultValue={options[3] || ''} placeholder="Option D" />
                        </div>
                        <input className="input" name="answer" defaultValue={question?.answer || ''} placeholder="Correct answer text" required={slot === 0} />
                      </div>
                    </details>
                  );
                })}
              </div>
              <input className="input" name="passingScore" type="number" min={1} max={100} defaultValue={quiz.passingScore} aria-label="Passing score" />
              <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-white hover:bg-[#16181C]">Update</button>
            </form>
            <form action="/api/instructor/quizzes" method="post">
              <CsrfInput />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="quizId" value={quiz.id} />
              <button className="rounded-full border border-[#2F3336] px-4 py-2 text-sm font-bold text-[#F4212E] hover:bg-[#16181C]">Delete</button>
            </form>
          </div>
          ];
        })}
      />
    </DashboardShell>
  );
}
