import { sendEmail } from '@/lib/email';
import { fromJsonObject, toJson } from '@/lib/json-fields';
import { prisma } from '@/lib/prisma';

export const automationTriggers = ['order.paid', 'course.published', 'student.inactive', 'ticket.opened'] as const;
export const automationActions = ['send.email', 'create.notification', 'tag.user'] as const;

export type AutomationTrigger = (typeof automationTriggers)[number];
export type AutomationAction = (typeof automationActions)[number];

type AutomationPayload = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  instructorId?: string;
  instructorEmail?: string;
  courseId?: string;
  courseTitle?: string;
  ticketId?: string;
  ticketEmail?: string;
  ticketSubject?: string;
  [key: string]: unknown;
};

function replaceVariables(template: string, payload: AutomationPayload) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => String(payload[key] ?? ''));
}

async function resolveUsers(target: string, payload: AutomationPayload) {
  const normalized = target.trim().toLowerCase();
  if (payload.userId && (!normalized || ['user', 'student', 'customer'].includes(normalized))) {
    return prisma.user.findMany({ where: { id: String(payload.userId) }, select: { id: true, email: true, name: true } });
  }
  if (payload.instructorId && normalized === 'instructor') {
    return prisma.user.findMany({ where: { id: String(payload.instructorId) }, select: { id: true, email: true, name: true } });
  }
  if (normalized === 'admins' || normalized === 'admin') {
    return prisma.user.findMany({ where: { role: 'ADMIN', status: 'APPROVED' }, select: { id: true, email: true, name: true }, take: 100 });
  }
  if (['students', 'student', 'instructors', 'instructor'].includes(normalized)) {
    const role = normalized.startsWith('instructor') ? 'INSTRUCTOR' : 'STUDENT';
    return prisma.user.findMany({ where: { role, status: 'APPROVED' }, select: { id: true, email: true, name: true }, take: 500 });
  }
  if (target.includes('@')) {
    return [{ id: '', email: target.trim(), name: target.trim() }];
  }
  return [];
}

async function executeAutomationAction(rule: { id: string; action: string; config: string | null }, payload: AutomationPayload) {
  const config = fromJsonObject<{ target?: string; message?: string }>(rule.config);
  const target = String(config.target || '').trim();
  const message = replaceVariables(String(config.message || 'Automation event received.'), payload);
  const users = await resolveUsers(target, payload);

  if (rule.action === 'send.email') {
    const fallbackEmail = String(payload.userEmail || payload.instructorEmail || payload.ticketEmail || '').trim();
    const recipients = users.length ? users.map((user) => user.email) : fallbackEmail ? [fallbackEmail] : [];
    if (!recipients.length) throw new Error('No email recipient matched the automation target.');
    await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: replaceVariables(String(payload.ticketSubject || payload.courseTitle || 'Platform automation'), payload),
          html: `<p>${message.replace(/\n/g, '<br />')}</p>`,
        }),
      ),
    );
    return `Sent ${recipients.length} email(s).`;
  }

  if (rule.action === 'create.notification') {
    const recipients = users.filter((user) => user.id);
    if (!recipients.length) throw new Error('No platform user matched the notification target.');
    const result = await prisma.notification.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        title: replaceVariables(String(payload.ticketSubject || payload.courseTitle || 'Platform automation'), payload),
        body: message,
      })),
    });
    return `Created ${result.count} notification(s).`;
  }

  if (rule.action === 'tag.user') {
    const tag = message || target || 'automation';
    const recipients = users.filter((user) => user.id);
    if (!recipients.length) throw new Error('No platform user matched the tag target.');
    await Promise.all(
      recipients.map((user) =>
        prisma.userProfileField.upsert({
          where: { userId_key: { userId: user.id, key: 'automation.tags' } },
          update: { value: tag },
          create: { userId: user.id, key: 'automation.tags', value: tag },
        }),
      ),
    );
    return `Tagged ${recipients.length} user(s).`;
  }

  throw new Error(`Unsupported automation action: ${rule.action}`);
}

export async function runAutomationRule(rule: { id: string; trigger: string; action: string; config: string | null }, payload: AutomationPayload = {}) {
  try {
    const message = await executeAutomationAction(rule, payload);
    await prisma.automationRun.create({
      data: { ruleId: rule.id, status: 'SUCCESS', log: `${rule.trigger}: ${message}` },
    });
    return { status: 'SUCCESS', message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.automationRun.create({
      data: { ruleId: rule.id, status: 'FAILED', log: `${rule.trigger}: ${message}` },
    });
    return { status: 'FAILED', message };
  }
}

export async function dispatchAutomationEvent(trigger: AutomationTrigger, payload: AutomationPayload) {
  const rules = await prisma.automationRule.findMany({
    where: { trigger, active: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!rules.length) return { matched: 0, succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;
  for (const rule of rules) {
    const result = await runAutomationRule(rule, payload);
    if (result.status === 'SUCCESS') succeeded += 1;
    else failed += 1;
  }

  return { matched: rules.length, succeeded, failed };
}

export async function runStudentInactiveAutomations(days = 14) {
  const cutoff = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', status: 'APPROVED', updatedAt: { lt: cutoff } },
    select: { id: true, email: true, name: true, updatedAt: true },
    take: 100,
  });

  for (const student of students) {
    await dispatchAutomationEvent('student.inactive', {
      userId: student.id,
      userEmail: student.email,
      userName: student.name,
      inactiveSince: student.updatedAt.toISOString(),
      inactiveDays: days,
    });
  }

  await prisma.auditLog.create({
    data: {
      action: 'automation.student_inactive.scan',
      entity: 'AutomationRule',
      entityId: 'student.inactive',
      metadata: toJson({ scanned: students.length, days }),
    },
  }).catch(() => null);

  return students.length;
}
