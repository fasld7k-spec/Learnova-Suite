import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const admin = await requireUser(['ADMIN']);
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            courses: true,
            enrollments: true,
            reviews: true,
            certificates: true,
            notifications: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    await audit({
      actorId: admin.id,
      action: 'export.users',
      entity: 'user',
      metadata: { count: users.length },
    });

    return csvResponse(
      `users-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['id', 'name', 'email', 'role', 'status', 'locale', 'coursesCreated', 'enrollments', 'reviews', 'certificates', 'notifications', 'createdAt', 'updatedAt'],
        users.map((user) => [
          user.id,
          user.name,
          user.email,
          user.role,
          user.status,
          user.locale,
          String(user._count.courses),
          String(user._count.enrollments),
          String(user._count.reviews),
          String(user._count.certificates),
          String(user._count.notifications),
          user.createdAt.toISOString(),
          user.updatedAt.toISOString(),
        ]),
      ),
    );
  } catch (error: any) {
    return fail(error.message || 'Users export failed.', 500);
  }
}
