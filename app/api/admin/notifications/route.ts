import { NextRequest, NextResponse } from 'next/server';
import { fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth';
import { verifyCsrf } from '@/lib/csrf';
import { filterInAppNotificationRecipients } from '@/lib/notification-preferences';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireUser(['ADMIN']);
    const form = await req.formData();
    if (!(await verifyCsrf(String(form.get('csrfToken') || '')))) return fail('Invalid CSRF token.', 403);
    const action = String(form.get('_action') || '').trim();
    const id = String(form.get('id') || '').trim();

    if (action === 'create') {
      const recipientMode = String(form.get('recipientMode') || 'user').trim();
      const userId = String(form.get('userId') || '').trim();
      const role = String(form.get('role') || '').trim().toUpperCase();
      const title = String(form.get('title') || '').trim();
      const body = String(form.get('body') || '').trim();

      if (!title || !body) return fail('Notification title and body are required.', 422);

      const users = await prisma.user.findMany({
        where:
          recipientMode === 'all'
            ? {}
            : recipientMode === 'role'
              ? { role }
              : { id: userId },
        select: { id: true },
      });

      if (!users.length) return fail('No recipients matched this notification.', 422);
      const recipientIds = await filterInAppNotificationRecipients(users.map((user) => user.id));
      if (!recipientIds.length) return fail('All matched recipients have disabled in-app notifications.', 422);

      const result = await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({ userId, title, body })),
      });

      await audit({
        actorId: admin.id,
        action: 'notification.create_bulk',
        entity: 'notification',
        metadata: { count: result.count, recipientMode, userId: userId || null, role: role || null, title },
      });

      return NextResponse.redirect(new URL('/admin/notifications?created=1', req.url), 303);
    }

    if (action === 'mark-all-read') {
      const result = await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
      await audit({ actorId: admin.id, action: 'notification.mark_all_read', entity: 'notification', metadata: { count: result.count } });
      return NextResponse.redirect(new URL('/admin/notifications?saved=1', req.url), 303);
    }

    if (action === 'purge-read') {
      const days = Math.max(1, Math.round(Number(form.get('days') || 90)));
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await prisma.notification.deleteMany({ where: { read: true, createdAt: { lt: cutoff } } });
      await audit({ actorId: admin.id, action: 'notification.purge_read', entity: 'notification', metadata: { days, count: result.count } });
      return NextResponse.redirect(new URL('/admin/notifications?deleted=1', req.url), 303);
    }

    if (!id) return fail('Notification ID is required.', 422);

    if (action === 'mark-read') {
      const notification = await prisma.notification.update({ where: { id }, data: { read: true } });
      await audit({ actorId: admin.id, action: 'notification.mark_read', entity: 'notification', entityId: notification.id, metadata: { userId: notification.userId } });
      return NextResponse.redirect(new URL('/admin/notifications?saved=1', req.url), 303);
    }

    if (action === 'delete') {
      const notification = await prisma.notification.delete({ where: { id } });
      await audit({ actorId: admin.id, action: 'notification.delete', entity: 'notification', entityId: notification.id, metadata: { userId: notification.userId, title: notification.title } });
      return NextResponse.redirect(new URL('/admin/notifications?deleted=1', req.url), 303);
    }

    return fail('Unsupported notification action.', 422);
  } catch (error: any) {
    return fail(error.message || 'Notification action failed.', 500);
  }
}
