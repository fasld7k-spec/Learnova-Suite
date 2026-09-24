import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const admin = await requireUser(['ADMIN']);
    const orders = await prisma.order.findMany({
      include: { items: true, payment: true, couponRedemptions: true },
      orderBy: { createdAt: 'desc' },
    });
    const users = orders.length
      ? await prisma.user.findMany({ where: { id: { in: [...new Set(orders.map((order) => order.userId))] } }, select: { id: true, name: true, email: true } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    await audit({
      actorId: admin.id,
      action: 'export.orders',
      entity: 'order',
      metadata: { count: orders.length },
    });

    return csvResponse(
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['id', 'invoice', 'customerName', 'customerEmail', 'total', 'currency', 'gateway', 'paymentStatus', 'orderStatus', 'items', 'couponRedemptions', 'transactionId', 'createdAt'],
        orders.map((order) => {
          const user = usersById.get(order.userId);
          return [
            order.id,
            order.invoiceNumber,
            user?.name || '',
            user?.email || '',
            String(order.total),
            order.currency,
            order.gateway,
            order.payment?.status || '',
            order.status,
            order.items.map((item) => `${item.title} (${item.price})`).join(' | '),
            String(order.couponRedemptions.length),
            order.payment?.transactionId || '',
            order.createdAt.toISOString(),
          ];
        }),
      ),
    );
  } catch (error: any) {
    return fail(error.message || 'Orders export failed.', 500);
  }
}
