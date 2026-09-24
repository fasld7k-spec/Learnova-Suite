import { prisma } from '@/lib/prisma';

export async function filterInAppNotificationRecipients(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) return [];

  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: { in: uniqueIds } },
    select: { userId: true, inApp: true },
  });
  const optedOut = new Set(preferences.filter((preference) => !preference.inApp).map((preference) => preference.userId));
  return uniqueIds.filter((userId) => !optedOut.has(userId));
}
