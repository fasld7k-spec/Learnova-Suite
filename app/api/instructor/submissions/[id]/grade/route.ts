import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { requireApprovedInstructor } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

const revisionPrefix = '[NEEDS_REVISION] ';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const instructor = await requireApprovedInstructor();
    const { id } = await params;
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);

    const outcome = String(form.get('outcome') || 'GRADED').trim().toUpperCase();
    const gradeValue = String(form.get('grade') || '').trim();
    const feedback = String(form.get('feedback') || '').trim();

    if (!['GRADED', 'NEEDS_REVISION'].includes(outcome)) return fail('Unsupported grading outcome.', 422);
    if (outcome === 'GRADED' && !gradeValue) return fail('Grade is required when marking a submission graded.', 422);
    const grade = gradeValue ? Number(gradeValue) : null;
    if (grade !== null && (!Number.isInteger(grade) || grade < 0 || grade > 100)) return fail('Grade must be an integer from 0 to 100.', 422);
    if (outcome === 'NEEDS_REVISION' && feedback.length < 3) return fail('Revision feedback is required.', 422);

    const submission = await prisma.assignmentSubmission.findUnique({ where: { id } });
    if (!submission) return fail('Submission not found.', 404);

    const assignment = await prisma.assignment.findUnique({ where: { id: submission.assignmentId } });
    if (!assignment) return fail('Submission not found.', 404);
    const course = await prisma.course.findUnique({ where: { id: assignment.courseId }, select: { instructorId: true, title: true } });
    if (!course || course.instructorId !== instructor.id) return fail('Submission not found.', 404);

    const nextFeedback = outcome === 'NEEDS_REVISION'
      ? `${revisionPrefix}${feedback.replace(revisionPrefix, '')}`
      : feedback.replace(revisionPrefix, '');

    await prisma.assignmentSubmission.update({
      where: { id },
      data: {
        grade: outcome === 'NEEDS_REVISION' ? null : grade,
        feedback: nextFeedback || null,
      },
    });

    await prisma.notification.create({
      data: {
        userId: submission.userId,
        title: outcome === 'NEEDS_REVISION' ? 'Assignment needs revision' : 'Assignment graded',
        body: outcome === 'NEEDS_REVISION'
          ? `${assignment.title} needs changes before final grading.`
          : `${assignment.title} was graded ${grade}/100.`,
      },
    }).catch(() => null);

    return NextResponse.redirect(new URL('/instructor/submissions?graded=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Unable to grade submission.', 500);
  }
}
