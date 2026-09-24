import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']);

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    const action = String(form.get('_action') || 'status').trim();
    const status = String(form.get('status') || '').trim().toUpperCase();
    if (!id) return fail('Course report ID is required.', 422);

    const existing = await prisma.courseReport.findUnique({ where: { id } });
    if (!existing) return fail('Course report not found.', 404);

    if (action === 'delete') {
      await prisma.courseReport.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: 'course_report.delete',
        entity: 'courseReport',
        entityId: id,
        metadata: { courseId: existing.courseId, userId: existing.userId },
      });
      return NextResponse.redirect(new URL('/admin/course-reports?deleted=1', req.url), 303);
    }

    if (action === 'queue') {
      const existingQueueItem = await prisma.moderationQueueItem.findFirst({
        where: { entity: 'COURSE', entityId: existing.courseId, reason: existing.reason, status: 'PENDING' },
      });
      if (!existingQueueItem) {
        await prisma.moderationQueueItem.create({
          data: { entity: 'COURSE', entityId: existing.courseId, reason: existing.reason, status: 'PENDING' },
        });
      }
      const report = await prisma.courseReport.update({ where: { id }, data: { status: 'REVIEWING' } });
      await audit({
        actorId: admin.id,
        action: 'course_report.queue',
        entity: 'courseReport',
        entityId: report.id,
        metadata: { courseId: report.courseId, userId: report.userId, queued: !existingQueueItem },
      });
      return NextResponse.redirect(new URL('/admin/course-reports?queued=1', req.url), 303);
    }

    if (!statuses.has(status)) return fail('Unsupported course report status.', 422);

    const report = await prisma.courseReport.update({ where: { id }, data: { status } });
    await audit({
      actorId: admin.id,
      action: 'course_report.status.update',
      entity: 'courseReport',
      entityId: report.id,
      metadata: { status, courseId: report.courseId, userId: report.userId },
    });

    return NextResponse.redirect(new URL('/admin/course-reports?saved=1', req.url), 303);
  } catch (error: any) {
    return fail(error.message || 'Course report could not be updated.', 500);
  }
}
