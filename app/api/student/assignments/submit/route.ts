import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { isLessonDripUnlocked } from '@/lib/drip-access';
import { isEnrolled } from '@/lib/enrollment';
import { prisma } from '@/lib/prisma';
import { saveProtectedFileToStorage } from '@/lib/storage';
import { validateStoredUrl } from '@/lib/url-validation';

const allowedSubmissionTypes = ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'image/png', 'image/jpeg', 'image/webp'];
const maxSubmissionBytes = 1024 * 1024 * 50;

async function saveAssignmentSubmissionFile(file: File | null) {
  const uploaded = await saveProtectedFileToStorage(file, {
    directory: 'assignment-submissions',
    allowedTypes: allowedSubmissionTypes,
    maxBytes: maxSubmissionBytes,
    purpose: 'Assignment submission'
  });
  return uploaded?.url || null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT']);
    const f = await req.formData();
    if (!(await verifyCsrf(String(f.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const assignment = await prisma.assignment.findUnique({ where: { id: String(f.get('assignmentId')) } });
    if (!assignment || !(await isEnrolled(user.id, assignment.courseId))) return fail('Assignment not found', 404);
    if (!(await isLessonDripUnlocked({ userId: user.id, courseId: assignment.courseId, lessonId: assignment.lessonId }))) {
      return fail('Assignment is not unlocked yet.', 403);
    }
    if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) {
      return fail('This assignment deadline has passed. Contact your instructor if you need a late submission exception.', 422);
    }
    const uploadedUrl = await saveAssignmentSubmissionFile(f.get('file') as File | null);
    const linkedUrl = validateStoredUrl(String(f.get('fileUrl') || ''), { label: 'Submission file URL', allowRelative: true });
    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        userId: user.id,
        content: String(f.get('content')),
        fileUrl: uploadedUrl || linkedUrl || null
      }
    });
    return NextResponse.redirect(new URL('/student/assignments', req.url), 303);
  } catch (e: any) {
    const message = e?.message || 'Unable to submit assignment';
    return fail(message, message.includes('URL') ? 422 : 500);
  }
}
