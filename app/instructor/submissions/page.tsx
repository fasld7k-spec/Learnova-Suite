import { CsrfInput } from '@/components/CsrfInput';
import { DataTable } from '@/components/dashboard/DataTable';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function submissionStatus(submission: { grade: number | null; feedback: string | null }) {
  if (submission.feedback?.startsWith('[NEEDS_REVISION]')) return 'Needs revision';
  if (submission.grade !== null) return 'Graded';
  return 'Pending review';
}

export default async function Submissions(props: { searchParams?: Promise<{ graded?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const user = await requireUser(['INSTRUCTOR']);
  const courses = await prisma.course.findMany({ where: { instructorId: user.id }, select: { id: true } });
  const assignments = await prisma.assignment.findMany({
    where: { courseId: { in: courses.map((course) => course.id) } },
    select: { id: true, title: true },
  });
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId: { in: assignments.map((assignment) => assignment.id) } },
    orderBy: { createdAt: 'desc' },
  });
  const students = submissions.length
    ? await prisma.user.findMany({ where: { id: { in: submissions.map((submission) => submission.userId) } } })
    : [];
  const assignmentTitles = new Map(assignments.map((assignment) => [assignment.id, assignment.title]));
  const studentNames = new Map(students.map((student) => [student.id, student.name]));

  return (
    <DashboardShell role="instructor" title="Assignment Submissions">
      {searchParams?.error ? (
        <div className="mb-6 border border-[#FFD400] bg-black p-4 text-sm font-bold text-[#FFD400]">{searchParams.error}</div>
      ) : searchParams?.graded ? (
        <div className="mb-6 border border-[#00BA7C] bg-black p-4 text-sm font-bold text-[#00BA7C]">Submission feedback saved successfully.</div>
      ) : null}
      <DataTable
        headers={['Assignment', 'Student', 'Content', 'File', 'Status', 'Grade & feedback']}
        rows={submissions.map((submission) => [
          assignmentTitles.get(submission.assignmentId) || 'Archived assignment',
          studentNames.get(submission.userId) || 'Student',
          submission.content,
          submission.fileUrl ? (
            <a className="text-[#1D9BF0]" href={submission.fileUrl} key="file">
              Open file
            </a>
          ) : '-',
          submissionStatus(submission),
          <form key="grade" className="grid min-w-72 gap-2" action={`/api/instructor/submissions/${submission.id}/grade`} method="post">
            <CsrfInput />
            <div className="grid gap-2 md:grid-cols-2">
              <select className="input" name="outcome" defaultValue={submission.feedback?.startsWith('[NEEDS_REVISION]') ? 'NEEDS_REVISION' : 'GRADED'}>
                <option value="GRADED">Grade</option>
                <option value="NEEDS_REVISION">Needs revision</option>
              </select>
              <input className="input" name="grade" type="number" min="0" max="100" defaultValue={submission.grade ?? ''} placeholder="0-100" />
            </div>
            <textarea className="input min-h-20" name="feedback" defaultValue={submission.feedback?.replace('[NEEDS_REVISION] ', '') || ''} placeholder="Feedback for the student" />
            <button className="btn-primary w-fit">Save feedback</button>
          </form>,
        ])}
      />
    </DashboardShell>
  );
}
