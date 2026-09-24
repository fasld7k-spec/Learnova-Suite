import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyCsrf } from '@/lib/csrf';

const statuses = new Set(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']);

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/abuse-reports', req.url), 303);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const id = String(form.get('id') || '').trim();
    const action = String(form.get('action') || '').trim();
    const status = String(form.get('status') || '').trim().toUpperCase();
    if (!id) return fail('Report id is required.', 422);

    const report = await prisma.abuseReport.findUnique({ where: { id } });
    if (!report) return fail('Report not found.', 404);

    if (action === 'queue') {
      const existingQueueItem = await prisma.moderationQueueItem.findFirst({
        where: { entity: report.targetType, entityId: report.targetId, reason: report.reason, status: 'PENDING' },
      });
      if (!existingQueueItem) {
        await prisma.moderationQueueItem.create({
          data: {
            entity: report.targetType,
            entityId: report.targetId,
            reason: report.reason,
            status: 'PENDING',
          },
        });
      }
      await prisma.abuseReport.update({ where: { id }, data: { status: 'REVIEWING' } });
      await audit({
        actorId: admin.id,
        action: 'abuse.queue',
        entity: report.targetType,
        entityId: report.targetId,
        metadata: { reportId: id, queued: !existingQueueItem },
      });
      return redirect(req);
    }

    if (!statuses.has(status)) return fail('Invalid report status.', 422);
    await prisma.abuseReport.update({ where: { id }, data: { status } });
    await audit({
      actorId: admin.id,
      action: 'abuse.status',
      entity: report.targetType,
      entityId: report.targetId,
      metadata: { reportId: id, status },
    });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'Unable to update abuse report.', 500);
  }
}
