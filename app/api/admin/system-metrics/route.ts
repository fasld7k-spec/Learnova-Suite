import { NextRequest, NextResponse } from 'next/server';

import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

function redirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/admin/system-metrics', req.url), 303);
}

function value(form: FormData, key: string) {
  return String(form.get(key) || '').trim();
}

async function databaseSizeBytes() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  try {
    if (/^postgres(ql)?:\/\//i.test(url)) {
      const rows = await prisma.$queryRawUnsafe<Array<{ size: bigint | number }>>('SELECT pg_database_size(current_database()) AS size');
      return Number(rows[0]?.size || 0);
    }
    if (url.startsWith('file:')) {
      const pageCount = await prisma.$queryRawUnsafe<Array<{ page_count: bigint | number }>>('PRAGMA page_count');
      const pageSize = await prisma.$queryRawUnsafe<Array<{ page_size: bigint | number }>>('PRAGMA page_size');
      return Number(pageCount[0]?.page_count || 0) * Number(pageSize[0]?.page_size || 0);
    }
  } catch {
    return 0;
  }
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(value(form, 'csrfToken')))) return fail('Invalid CSRF token.', 403);

    const action = value(form, '_action') || 'create';
    const id = value(form, 'id');

    if (action === 'delete') {
      if (!id) return fail('Metric snapshot id is required.', 422);
      await prisma.systemMetricSnapshot.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'system_metric.delete', entity: 'SystemMetricSnapshot', entityId: id });
      return redirect(req);
    }

    if (action === 'collect-snapshot') {
      const [
        dbSize,
        users,
        courses,
        pendingOrders,
        failedPayments,
        pendingJobs,
        failedJobs,
        failedBackups,
        openTickets,
        unreadNotifications,
      ] = await Promise.all([
        databaseSizeBytes(),
        prisma.user.count(),
        prisma.course.count(),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.payment.count({ where: { status: 'FAILED' } }),
        prisma.jobQueue.count({ where: { status: 'PENDING' } }).catch(() => 0),
        prisma.jobQueue.count({ where: { status: 'FAILED' } }).catch(() => 0),
        prisma.backupLog.count({ where: { status: 'FAILED' } }).catch(() => 0),
        prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }).catch(() => 0),
        prisma.notification.count({ where: { read: false } }).catch(() => 0),
      ]);

      const metrics = {
        'database.size_bytes': dbSize,
        'users.total': users,
        'courses.total': courses,
        'orders.pending': pendingOrders,
        'payments.failed': failedPayments,
        'jobs.pending': pendingJobs,
        'jobs.failed': failedJobs,
        'backups.failed': failedBackups,
        'support.open': openTickets,
        'notifications.unread': unreadNotifications,
      };
      await prisma.systemMetricSnapshot.createMany({
        data: Object.entries(metrics).map(([key, metricValue]) => ({ key, value: metricValue })),
      });
      await audit({ actorId: admin.id, action: 'system_metric.collect_snapshot', entity: 'SystemMetricSnapshot', metadata: metrics });
      return NextResponse.redirect(new URL('/admin/system-metrics?collected=1', req.url), 303);
    }

    const key = value(form, 'key').toLowerCase().replace(/[^a-z0-9_.:-]+/g, '.');
    const metricValue = Number(value(form, 'value') || 0);
    if (key.length < 2) return fail('Metric key is required.', 422);
    if (!Number.isFinite(metricValue)) return fail('Metric value must be numeric.', 422);

    const data = { key, value: metricValue };
    if (action === 'update') {
      if (!id) return fail('Metric snapshot id is required.', 422);
      await prisma.systemMetricSnapshot.update({ where: { id }, data });
      await audit({ actorId: admin.id, action: 'system_metric.update', entity: 'SystemMetricSnapshot', entityId: id });
      return redirect(req);
    }

    const row = await prisma.systemMetricSnapshot.create({ data });
    await audit({ actorId: admin.id, action: 'system_metric.create', entity: 'SystemMetricSnapshot', entityId: row.id });
    return redirect(req);
  } catch (error: any) {
    return fail(error.message || 'System metric update failed.', 500);
  }
}
