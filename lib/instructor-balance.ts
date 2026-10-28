import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

const RESERVED_WITHDRAWAL_STATUSES = ['PENDING', 'APPROVED', 'PAID'];

export class WithdrawalExceedsBalanceError extends Error {
  constructor(public available: number) {
    super('Withdrawal exceeds available balance.');
  }
}

/** Earnings from paid orders minus every pending, approved or paid withdrawal (all rows, not a page). */
export async function instructorBalance(db: Db, instructorId: string) {
  const courses = await db.course.findMany({ where: { instructorId }, select: { id: true } });
  const courseIds = courses.map((course) => course.id);
  const [earnings, reserved] = await Promise.all([
    courseIds.length
      ? db.orderItem.aggregate({
          where: { courseId: { in: courseIds }, order: { status: 'PAID' } },
          _sum: { instructorEarning: true },
        })
      : Promise.resolve({ _sum: { instructorEarning: null } }),
    db.withdrawal.aggregate({
      where: { instructorId, status: { in: RESERVED_WITHDRAWAL_STATUSES } },
      _sum: { amount: true },
    }),
  ]);
  const totalEarnings = Number(earnings._sum.instructorEarning ?? 0);
  const reservedAmount = Number(reserved._sum.amount ?? 0);
  return { totalEarnings, reserved: reservedAmount, available: Math.max(totalEarnings - reservedAmount, 0) };
}

/**
 * Checks the balance and creates the withdrawal in one serializable transaction,
 * so parallel requests cannot each spend the same balance.
 */
export async function createWithdrawalWithinBalance(instructorId: string, amount: number, method: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const { available } = await instructorBalance(tx, instructorId);
          if (amount > available + 1e-9) throw new WithdrawalExceedsBalanceError(available);
          return tx.withdrawal.create({ data: { instructorId, amount, method, status: 'PENDING' } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      if (error?.code !== 'P2034' || attempt === 2) throw error;
    }
  }
  throw new Error('Withdrawal could not be completed.');
}
