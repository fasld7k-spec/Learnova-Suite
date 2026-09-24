import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { processCourseExportJob } from '@/lib/course-transfer';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

const formats = new Set(['csv', 'backup', 'json']);

function formValue(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = formValue(form, '_action') || 'create';

    if (action === 'retry') {
      const jobId = formValue(form, 'jobId');
      if (!jobId) return fail('Export job is required.', 422);
      const job = await prisma.courseExportJob.findUnique({ where: { id: jobId } });
      if (!job) return fail('Export job not found.', 404);
      await prisma.courseExportJob.update({ where: { id: jobId }, data: { status: 'PENDING', fileUrl: null } });
      await processCourseExportJob(jobId);
      await audit({ actorId: admin.id, action: 'course_export.retry', entity: 'CourseExportJob', entityId: jobId });
      return NextResponse.redirect(new URL('/admin/course-import-export?exportRetried=1', req.url), 303);
    }

    if (action === 'delete') {
      const jobId = formValue(form, 'jobId');
      if (!jobId) return fail('Export job is required.', 422);
      await prisma.courseExportJob.delete({ where: { id: jobId } });
      await audit({ actorId: admin.id, action: 'course_export.delete', entity: 'CourseExportJob', entityId: jobId });
      return NextResponse.redirect(new URL('/admin/course-import-export?exportDeleted=1', req.url), 303);
    }

    if (action === 'purge_old') {
      const days = Math.max(1, Number(formValue(form, 'days') || 30));
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.courseExportJob.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await audit({ actorId: admin.id, action: 'course_export.purge_old', entity: 'CourseExportJob', metadata: { days, deleted: result.count } });
      return NextResponse.redirect(new URL(`/admin/course-import-export?exportPurged=${result.count}`, req.url), 303);
    }

    if (action !== 'create') return fail('Unsupported export action.', 422);

    const courseId = formValue(form, 'courseId');
    const format = formValue(form, 'format').toLowerCase() || 'json';
    if (!courseId) return fail('Course is required.', 422);
    if (!formats.has(format)) return fail('Unsupported export format.', 422);

    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) return fail('Course not found.', 404);

    const job = await prisma.courseExportJob.create({ data: { courseId, format, status: 'PENDING' } });
    await processCourseExportJob(job.id);
    await audit({ actorId: admin.id, action: 'course_export.create', entity: 'CourseExportJob', entityId: job.id, metadata: { courseId, format } });
    return NextResponse.redirect(new URL('/admin/course-import-export?exported=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Course export failed.', 500);
  }
}
