export type NotificationCategory = {
  label: 'Commerce' | 'Message' | 'Live' | 'Learning' | 'System';
  tone: 'green' | 'blue' | 'yellow' | 'slate';
};

export type MessagePriority = 'normal' | 'important' | 'urgent';

export type ConversationActivity = {
  createdAt?: Date | string | null;
};

const notificationCategories: Array<{ pattern: RegExp; category: NotificationCategory }> = [
  { pattern: /payment|invoice|order|refund|checkout/i, category: { label: 'Commerce', tone: 'green' } },
  { pattern: /message|chat|reply|conversation/i, category: { label: 'Message', tone: 'blue' } },
  { pattern: /live|session|class|booking/i, category: { label: 'Live', tone: 'yellow' } },
  { pattern: /certificate|course|lesson|enrollment/i, category: { label: 'Learning', tone: 'slate' } }
];

export function classifyNotification(input: { title: string; body: string }): NotificationCategory {
  const text = `${input.title} ${input.body}`;
  return notificationCategories.find((entry) => entry.pattern.test(text))?.category ?? { label: 'System', tone: 'slate' };
}

export function applyMessagePriority(body: string, priority: MessagePriority) {
  const text = body.trim();
  if (!text) return '';
  if (priority === 'normal') return text;
  return `[${priority.toUpperCase()}] ${text}`;
}

export function priorityFromMessage(body: string): Exclude<MessagePriority, 'normal'> | null {
  if (body.startsWith('[URGENT]')) return 'urgent';
  if (body.startsWith('[IMPORTANT]')) return 'important';
  return null;
}

export function isActiveWithin(activity: ConversationActivity, now: Date, hours: number) {
  if (!activity.createdAt) return false;
  const createdAt = new Date(activity.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return now.getTime() - createdAt.getTime() < hours * 60 * 60 * 1000;
}

export function supportTicketAgeHours(createdAt: Date, now: Date) {
  return Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / (60 * 60 * 1000)));
}
