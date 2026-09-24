import { prisma } from '@/lib/prisma';

type AchievementInput = {
  userId: string;
  title: string;
  reason: string;
  icon?: string | null;
  notify?: boolean;
};

function clean(value: string, max: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function awardAchievement(input: AchievementInput) {
  const title = clean(input.title, 120);
  const reason = clean(input.reason, 220);
  const icon = input.icon ? clean(input.icon, 40) : null;

  if (!input.userId || title.length < 2 || reason.length < 2) return null;

  const existing = await prisma.badgeAward.findFirst({
    where: {
      userId: input.userId,
      title,
      reason,
    },
  });
  if (existing) return existing;

  const badge = await prisma.badgeAward.create({
    data: {
      userId: input.userId,
      title,
      icon,
      reason,
    },
  });

  if (input.notify !== false) {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        title: `Achievement unlocked: ${title}`,
        body: reason,
      },
    }).catch(() => null);
  }

  return badge;
}
