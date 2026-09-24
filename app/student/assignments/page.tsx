import { FileUp, SquareCheckBig } from 'lucide-react';
import { CsrfInput } from '@/components/CsrfInput';
import { FileUploadLabel } from '@/components/instructor/FileUploadLabel';
import { requireUser } from '@/lib/auth';
import { isLessonDripUnlocked } from '@/lib/drip-access';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

function submissionStatus(submission?: { grade: number | null; feedback: string | null }) {
  if (!submission) return 'Pending';
  if (submission.feedback?.startsWith('[NEEDS_REVISION]')) return 'Needs revision';
  if (submission.grade !== null) return 'Graded';
  return 'Submitted';
}

export default async function StudentAssignments() {
  const user = await requireUser(['STUDENT']);
  const enrollments = await prisma.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true, course: { select: { title: true } } } });
  const courseIds = enrollments.map((enrollment) => enrollment.courseId);
  const assignmentRows = await prisma.assignment.findMany({ where: { courseId: { in: courseIds } }, orderBy: { dueAt: 'asc' } });
  const lessonRows = await prisma.lesson.findMany({
    where: { id: { in: assignmentRows.map((assignment) => assignment.lessonId).filter((lessonId): lessonId is string => Boolean(lessonId)) } },
    select: { id: true, title: true }
  });
  const lessonTitles = new Map(lessonRows.map((lesson) => [lesson.id, lesson.title]));
  const dripAccess = await Promise.all(assignmentRows.map((assignment) =>
    isLessonDripUnlocked({ userId: user.id, courseId: assignment.courseId, lessonId: assignment.lessonId })
  ));
  const rows = assignmentRows.filter((_, index) => dripAccess[index]);
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { userId: user.id, assignmentId: { in: rows.map((assignment) => assignment.id) } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <DashboardShell role="student" title="Assignments">
      <div className="grid gap-4">
        {rows.map((assignment) => {
          const latestSubmission = submissions.find((submission) => submission.assignmentId === assignment.id);
          const courseTitle = enrollments.find((enrollment) => enrollment.courseId === assignment.courseId)?.course.title || 'Course';

          return (
            <div className="border border-[#2F3336] bg-black p-5" key={assignment.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#1D9BF0]">{courseTitle}</p>
                  {assignment.lessonId ? <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#71767B]">Lesson: {lessonTitles.get(assignment.lessonId) || 'Archived lesson'}</p> : null}
                  <h2 className="mt-1 text-xl font-black text-white">{assignment.title}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71767B]">{assignment.description}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${latestSubmission ? latestSubmission.feedback?.startsWith('[NEEDS_REVISION]') ? 'border-[#FFD400] text-[#FFD400]' : 'border-[#00BA7C] text-[#00BA7C]' : 'border-[#2F3336] text-[#71767B]'}`}>
                  {submissionStatus(latestSubmission)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#71767B]">
                <span className="rounded-full bg-[#16181C] px-3 py-1">Due: {assignment.dueAt?.toLocaleString() || 'No due date'}</span>
                {latestSubmission && <span className="rounded-full bg-[#16181C] px-3 py-1">Grade: {latestSubmission.grade ?? 'Pending review'}</span>}
              </div>

              {latestSubmission && (
                <div className="mt-4 border border-[#2F3336] bg-[#16181C] p-4 text-sm text-[#E7E9EA]">
                  <p className="flex items-center gap-2 font-bold text-white">
                    <SquareCheckBig size={17} className="text-[#00BA7C]" />
                    Last submission
                  </p>
                  <p className="mt-2 text-[#71767B]">{latestSubmission.content}</p>
                  {latestSubmission.feedback && (
                    <p className="mt-3 rounded-2xl border border-[#2F3336] bg-black p-3 text-[#E7E9EA]">
                      {latestSubmission.feedback.replace('[NEEDS_REVISION] ', '')}
                    </p>
                  )}
                  {latestSubmission.fileUrl && <a className="mt-2 inline-block font-bold text-[#1D9BF0]" href={latestSubmission.fileUrl}>Open file</a>}
                </div>
              )}

              <form className="mt-4 grid gap-3" action="/api/student/assignments/submit" method="post" encType="multipart/form-data">
                <CsrfInput />
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <textarea className="input min-h-28" name="content" placeholder="Your answer" required />
                <div className="grid gap-3 md:grid-cols-2">
                  <FileUploadLabel
                    name="file"
                    accept="application/pdf,application/zip,application/x-zip-compressed,image/png,image/jpeg,image/webp"
                    title="Upload submission file"
                    hint="PDF, ZIP, PNG, JPG, or WEBP. Max 50MB."
                  />
                  <input className="input" name="fileUrl" placeholder="Or paste a file URL / cloud share link" />
                </div>
                <button className="btn-primary w-fit">
                  <FileUp size={17} />
                  Submit assignment
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}
