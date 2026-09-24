import { sendEmail } from '@/lib/email';
import { runStudentInactiveAutomations } from '@/lib/automation';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { retryWebhookDelivery } from '@/lib/outbound-webhooks';
import { prisma } from '@/lib/prisma';

type JobResult = { id: string; type: string; status: string; message: string };

export const supportedJobTypes = [
  'email.send',
  'notification.broadcast',
  'notification.cleanup',
  'reports.snapshot',
  'analytics.rollup',
  'webhooks.retry-failed',
  'automation.student-inactive',
] as const;

export async function enqueue(type: string, payload: any, runAt = new Date()) {
  if (!supportedJobTypes.includes(type as any)) throw new Error(`Unsupported job type: ${type}`);
  return prisma.jobQueue.create({ data: { type, payload: toJson(payload), runAt } });
}

export async function markJobDone(id: string) {
  return prisma.jobQueue.update({ where: { id }, data: { status: 'DONE', lastError: null } });
}

async function sendQueuedEmail(payload: unknown) {
  const data = fromJsonObject<Record<string, string>>(payload);
  const to = String(data.recipient || data.to || '').trim();
  const subject = String(data.subject || 'Learnova Suite update').trim();
  const body = String(data.body || data.message || 'This message was sent from the background job queue.').trim();
  if (!to || !to.includes('@')) throw new Error('A valid recipient email is required.');

  const result = await sendEmail({ to, subject, html: `<p>${body.replace(/\n/g, '<br />')}</p>` });
  return `Email ${result.status.toLowerCase()} for ${to}`;
}

async function broadcastNotification(payload: unknown) {
  const data = fromJsonObject<Record<string, string>>(payload);
  const title = String(data.subject || data.title || 'Platform update').trim();
  const body = String(data.body || data.message || 'You have a new platform notification.').trim();
  const role = String(data.role || '').trim().toUpperCase();
  const where = role ? { role } : {};
  const users = await prisma.user.findMany({ where, select: { id: true }, take: 1000 });
  if (!users.length) return 'No users matched the broadcast filter';

  const result = await prisma.notification.createMany({
    data: users.map((user) => ({ userId: user.id, title, body })),
  });
  return `Created ${result.count} notifications`;
}

async function cleanupNotifications() {
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);
  const result = await prisma.notification.deleteMany({ where: { read: true, createdAt: { lt: cutoff } } });
  return `Cleaned ${result.count} old notifications`;
}

async function snapshotReports() {
  const [users, courses, orders, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.order.count(),
    prisma.order.aggregate({ where: { status: 'PAID' }, _sum: { total: true } }),
  ]);
  await prisma.auditLog.create({
    data: {
      actorId: 'system',
      action: 'reports.snapshot',
      entity: 'JobQueue',
      entityId: 'reports.snapshot',
      metadata: toJson({ users, courses, orders, revenue: Number(revenue._sum.total || 0) }),
    },
  });
  return 'Reporting snapshot recorded';
}

async function rollupAnalytics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [pageViews, courseViews, paidOrders] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: today } } }),
    prisma.courseView.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { status: 'PAID', createdAt: { gte: today } } }),
  ]);
  await prisma.systemMetricSnapshot.createMany({
    data: [
      { key: 'analytics.page_views.today', value: pageViews },
      { key: 'analytics.course_views.today', value: courseViews },
      { key: 'analytics.paid_orders.today', value: paidOrders },
    ],
  });
  return `Analytics rollup saved: ${pageViews} page views, ${courseViews} course views, ${paidOrders} paid orders`;
}

async function retryFailedWebhooks() {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { status: 'FAILED' },
    orderBy: { createdAt: 'asc' },
    take: 25,
  });
  let retried = 0;
  for (const delivery of deliveries) {
    await retryWebhookDelivery(delivery.id);
    retried += 1;
  }
  return `Retried ${retried} failed webhook deliveries`;
}

async function scanInactiveStudents(payload: unknown) {
  const data = fromJsonObject<Record<string, string>>(payload);
  const days = Number(data.days || data.inactiveDays || 14);
  const scanned = await runStudentInactiveAutomations(Number.isFinite(days) ? days : 14);
  return `Ran inactive student automations for ${scanned} student(s)`;
}

async function executeQueuedJob(type: string, payload: unknown) {
  if (type === 'email.send') return sendQueuedEmail(payload);
  if (type === 'notification.broadcast') return broadcastNotification(payload);
  if (type === 'notification.cleanup') return cleanupNotifications();
  if (type === 'reports.snapshot') return snapshotReports();
  if (type === 'analytics.rollup') return rollupAnalytics();
  if (type === 'webhooks.retry-failed') return retryFailedWebhooks();
  if (type === 'automation.student-inactive') return scanInactiveStudents(payload);
  throw new Error(`Unsupported job type: ${type}`);
}

export async function runDueJobs(limit = 10): Promise<JobResult[]> {
  const jobs = await prisma.jobQueue.findMany({
    where: { status: 'PENDING', runAt: { lte: new Date() } },
    orderBy: { runAt: 'asc' },
    take: limit,
  });

  const results: JobResult[] = [];

  for (const job of jobs) {
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
    });

    try {
      const message = await executeQueuedJob(job.type, job.payload);
      await prisma.jobQueue.update({ where: { id: job.id }, data: { status: 'DONE', lastError: message } });
      results.push({ id: job.id, type: job.type, status: 'DONE', message });
    } catch (error: any) {
      const attempts = job.attempts + 1;
      const failed = attempts >= 3;
      const message = error?.message || 'Job failed';
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: failed ? 'FAILED' : 'PENDING',
          lastError: message,
          runAt: failed ? job.runAt : new Date(Date.now() + 1000 * 60 * attempts),
        },
      });
      results.push({ id: job.id, type: job.type, status: failed ? 'FAILED' : 'PENDING', message });
    }
  }

  return results;
}
