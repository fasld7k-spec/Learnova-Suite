import { NextRequest, NextResponse } from 'next/server';
import { fail, handleRouteError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function formError(req: NextRequest, message: string, status = 422) {
  if (req.headers.get('accept')?.includes('application/json')) return fail(message, status);
  const url = new URL('/student/job-applications', req.url);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(['STUDENT', 'ADMIN']);
    const form = await req.formData().catch(() => null);
    if (!form) return formError(req, 'Invalid job application request.');
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return formError(req, 'Invalid CSRF token.', 403);
    const jobId = String(form.get('jobId') || '').trim();
    const coverNote = String(form.get('coverNote') || '').trim().slice(0, 2000);

    if (!jobId) return formError(req, 'Choose a job before applying.');
    if (coverNote.length < 20) return formError(req, 'Cover note must be at least 20 characters.');
    const job = await prisma.jobBoardPost.findFirst({ where: { id: jobId, active: true }, select: { id: true, title: true } });
    if (!job) return formError(req, 'This job post is no longer available.', 404);

    await prisma.jobApplication.upsert({
      where: { jobId_userId: { jobId, userId: user.id } },
      update: { coverNote, status: 'APPLIED' },
      create: { jobId, userId: user.id, coverNote },
    });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } }).catch(() => []);
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: 'Job application submitted',
        body: `${user.name} applied for ${job.title}.`,
      })),
    }).catch(() => null);
    return NextResponse.redirect(new URL('/student/job-applications', req.url), 303);
  } catch (e: any) {
    if (e?.message === 'UNAUTHENTICATED' || e?.message === 'FORBIDDEN') return handleRouteError(e, req);
    return formError(req, e?.message || 'Unable to submit application.', 500);
  }
}
