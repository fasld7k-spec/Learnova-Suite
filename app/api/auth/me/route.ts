import { handleError, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { getCached } from '@/lib/cache';
import { prisma } from '@/lib/prisma';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  bio: true,
  locale: true,
  status: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function currentUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new Error('UNAUTHENTICATED');

    const user = await getCached(
      `user:${session.id}:profile`,
      () => currentUserProfile(session.id),
      120,
    );

    return ok(user);
  } catch (error) {
    return handleError(error);
  }
}
